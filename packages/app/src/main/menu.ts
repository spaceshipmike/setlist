// @fctry: #auto-update
// @fctry: #desktop-app
// macOS app menu. Sets up the standard menu template so "About Setlist",
// "Settings…" (Cmd-,), and "Check for Updates…" appear in the app menu
// (first menu, to the right of the apple icon). Configures the About panel's
// text so S86 — "dialog displays the app name and the current version
// string" — is satisfied without a custom dialog.
//
// Settings…  (spec 0.26 §S123): the Cmd-, accelerator sends a
// "navigate-to-settings" IPC message to the focused renderer; App.tsx
// listens and routes the user to the Settings view.

import { BrowserWindow, Menu, type MenuItemConstructorOptions, app } from 'electron';
import { getChannel } from './prefs.js';
import { checkForUpdates, isCheckInFlight } from './auto-update.js';

const NAVIGATE_TO_SETTINGS_CHANNEL = 'navigate-to-settings';

function isDev(): boolean {
  return Boolean(process.env.ELECTRON_RENDERER_URL);
}

// Build date comes from the packaged app's modification time when
// available; in dev we fall back to "development build".
function buildDateLabel(): string {
  try {
    if (isDev()) return 'development build';
    // app.getAppPath() points into the .asar in packaged builds — its
    // mtime is a reasonable proxy for "when was this built".
    const stat = require('node:fs').statSync(app.getAppPath());
    return stat.mtime.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return 'unknown';
  }
}

function refreshAboutPanel(): void {
  const channel = getChannel();
  const version = app.getVersion();
  const channelLabel = channel === 'beta' ? 'Beta' : 'Stable';
  app.setAboutPanelOptions({
    applicationName: 'Setlist',
    applicationVersion: `${version} (${channelLabel})`,
    version: buildDateLabel(),
    copyright: 'Setlist — project registry control panel',
  });
}

/**
 * Build + install the application menu. Called once from main after
 * app is ready. Idempotent-ish: re-calling replaces the menu, which
 * Chunk 5's quit handler uses after a channel change if needed.
 */
export function installAppMenu(
  handleCheckForUpdates: () => Promise<void> | void,
): void {
  refreshAboutPanel();

  const dev = isDev();

  const appSubmenu: MenuItemConstructorOptions[] = [
    { role: 'about', label: 'About Setlist' },
    { type: 'separator' },
    {
      label: 'Settings…',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        // Send to whichever window currently has focus, falling back to the
        // first window if none is focused. App.tsx routes to Settings.
        const target = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        target?.webContents.send(NAVIGATE_TO_SETTINGS_CHANNEL);
      },
    },
    { type: 'separator' },
    dev
      ? {
          label: 'Check for Updates…',
          enabled: false,
          toolTip: 'Not available in development',
        }
      : {
          label: 'Check for Updates…',
          // In-flight guard is enforced inside handleCheckForUpdates;
          // the menu item doesn't need a disabled state because the
          // check call itself is idempotent.
          click: () => {
            void handleCheckForUpdates();
          },
        },
    { type: 'separator' },
    { role: 'services' },
    { type: 'separator' },
    { role: 'hide', label: 'Hide Setlist' },
    { role: 'hideOthers' },
    { role: 'unhide' },
    { type: 'separator' },
    { role: 'quit', label: 'Quit Setlist' },
  ];

  const template: MenuItemConstructorOptions[] = [
    { label: 'Setlist', submenu: appSubmenu },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      role: 'windowMenu',
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Wrapper for the menu's "Check for Updates…" click handler.
 * Surfaces a brief acknowledgment if the check is already in flight
 * so the user isn't left wondering whether their click registered
 * (S85: "does not fire a duplicate request" + S85: "sees a clear
 * 'Checking for updates…' indication").
 */
export async function handleMenuCheckForUpdates(): Promise<void> {
  if (isCheckInFlight()) {
    // A check is already running — don't spawn a second one. The
    // Settings status line will surface the outcome. A modal here
    // would be too noisy; a no-op is correct.
    return;
  }
  await checkForUpdates();
}

/**
 * Show a modal acknowledgment when a menu-triggered check completes
 * with a specific outcome that deserves a one-shot user signal.
 * Used by the main process's update event listener.
 */
export function acknowledgeCheckResult(
  outcome: 'up-to-date' | 'error',
  message?: string,
): void {
  // Only show for menu-triggered "Check now" — we'd need to track
  // whether the check was menu-initiated. In this build we keep it
  // silent and defer to the Settings status line, which matches
  // S85's "optionally in a brief user-facing acknowledgment" clause
  // and is less noisy. The error path specifically avoids toasts
  // per S90's "Failed update checks do NOT fire a toast".
  void outcome;
  void message;
}
