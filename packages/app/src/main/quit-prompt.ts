// @fctry: #auto-update
// Quit interception for the auto-update install prompt.
//
// When a user initiates a quit (Cmd-Q, App > Quit Setlist, closing last
// window if that path quits the app) and an update is staged, show a
// modal asking "Install now or Skip?". Skip quits without installing;
// the staged update remains on disk and reappears on next quit.
//
// Scenario coverage: S89.

import { app, dialog, type App, type BrowserWindow } from 'electron';
import { isUpdateDownloaded, getDownloadedVersion, quitAndInstall } from './auto-update.js';

// Guard so we don't re-enter the prompt after user chooses Install
// (quitAndInstall triggers another quit internally).
let installing = false;

/**
 * Register a before-quit listener that surfaces the install-or-skip
 * prompt when an update is staged. Must be called once during
 * app.whenReady().
 *
 * @param getMainWindow  lookup used to parent the modal dialog
 */
export function registerQuitPrompt(electronApp: App, getMainWindow: () => BrowserWindow | null): void {
  electronApp.on('before-quit', (event) => {
    if (installing) return; // second pass after Install now — allow quit
    if (!isUpdateDownloaded()) return; // nothing to install

    // Block the default quit; we'll resume it explicitly.
    event.preventDefault();

    const version = getDownloadedVersion();
    const versionLabel = version ? `v${version}` : 'a new version';
    const parent = getMainWindow() ?? undefined;

    const choice = dialog.showMessageBoxSync(parent as BrowserWindow, {
      type: 'info',
      buttons: ['Install and quit', 'Skip'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: 'Update ready — install now or skip?',
      detail: `Setlist will install ${versionLabel} and relaunch after install. Choosing Skip quits without installing; the update stays staged and you'll be asked again next time you quit.`,
    });

    if (choice === 0) {
      // Install path: mark so the follow-up quit isn't intercepted,
      // then trigger quitAndInstall. electron-updater handles the
      // handoff to Squirrel.Mac on macOS.
      installing = true;
      quitAndInstall();
      // quitAndInstall itself quits the app; no explicit app.quit() here.
    } else {
      // Skip path: quit normally, leaving the downloaded update staged.
      // Setting installing=false keeps the prompt active on next quit.
      app.exit(0);
    }
  });
}
