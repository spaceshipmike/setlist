// @fctry: #auto-update
// electron-updater integration.
//
// Reads the update channel from user prefs (Chunk 1) — the spec uses
// 'stable' / 'beta' language; electron-updater's channel property uses
// 'latest' for the stable feed, so we map at the boundary. The
// allowPrerelease flag is the primary lever for GitHub's prerelease
// semantics: beta allows prereleases, stable does not.
//
// Events are emitted as IPC messages to any attached renderer window(s)
// plus a main-process callback (for menu state, quit-prompt logic).
// Last-check status is persisted via prefs so it survives launches.

import pkg from 'electron-updater';
import type { BrowserWindow } from 'electron';
import { BrowserWindow as BW } from 'electron';
import type { UpdateChannel, UpdateOutcome } from './prefs.js';
import { getChannel, setLastCheck } from './prefs.js';

const { autoUpdater } = pkg;

export interface UpdateEventPayload {
  outcome: UpdateOutcome;
  version?: string;
  message?: string;
  timestamp: string;
}

type Listener = (event: UpdateEventPayload) => void;

// ── module-level state ────────────────────────────────────────────
let initialized = false;
let checkInFlight = false;
let updateDownloaded = false;
let downloadedVersion: string | null = null;
let pollInterval: NodeJS.Timeout | null = null;
const listeners = new Set<Listener>();

// ── helpers ───────────────────────────────────────────────────────

function channelToPrereleaseFlag(channel: UpdateChannel): boolean {
  return channel === 'beta';
}

function channelToUpdaterName(channel: UpdateChannel): 'latest' | 'beta' {
  // electron-updater's `channel` controls which YAML file to fetch
  // (latest.yml vs beta.yml). Our spec language is 'stable'; the
  // mapping is a boundary concern.
  return channel === 'beta' ? 'beta' : 'latest';
}

function nowIso(): string {
  return new Date().toISOString();
}

function emit(payload: UpdateEventPayload): void {
  // Persist to prefs so Settings status line survives launches (S90).
  setLastCheck({
    timestamp: payload.timestamp,
    outcome: payload.outcome,
    ...(payload.message !== undefined ? { message: payload.message } : {}),
    ...(payload.version !== undefined ? { version: payload.version } : {}),
  });

  // Broadcast to all renderer windows and in-process listeners.
  for (const win of BW.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('update-event', payload);
    }
  }
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (err) {
      console.error('[auto-update] listener threw:', err);
    }
  }
}

function plainError(err: unknown): string {
  if (!err) return 'Unknown error';
  const raw = err instanceof Error ? err.message : String(err);
  // Translate common electron-updater error shapes into plain language.
  // Matches S90 requirement: "not a raw exception string or stack trace".
  if (/ENOTFOUND|ENETUNREACH|EAI_AGAIN/i.test(raw)) return 'No network connection';
  if (/404/.test(raw)) return 'GitHub feed returned 404';
  if (/signature|code signing/i.test(raw)) return 'Signature verification failed';
  if (/ETIMEDOUT|timeout/i.test(raw)) return 'Update check timed out';
  // Trim to a single line, no stack.
  const firstLine = raw.split('\n')[0];
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}…` : firstLine;
}

// ── public API ────────────────────────────────────────────────────

/**
 * Wire electron-updater event handlers and (optionally) kick off an
 * initial check + periodic polling. Idempotent: calling twice is a
 * no-op beyond re-applying the current channel.
 *
 * @param options.autoCheck  if true (default), perform an initial check
 *                           and start the 4-hour polling loop. Tests and
 *                           the menu-triggered path pass false.
 */
export function initAutoUpdater(options: { autoCheck?: boolean } = {}): void {
  const { autoCheck = true } = options;

  // Apply channel from prefs on every call — this lets the Settings
  // toggle propagate to a running updater without re-wiring handlers.
  applyChannel(getChannel());

  if (initialized) {
    if (autoCheck && !pollInterval) schedulePolling();
    return;
  }
  initialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    checkInFlight = true;
    emit({ outcome: 'checking', timestamp: nowIso() });
  });

  autoUpdater.on('update-available', (info) => {
    checkInFlight = false; // transitions to 'downloading' below
    emit({
      outcome: 'update-available',
      version: info?.version,
      timestamp: nowIso(),
    });
    // electron-updater begins the download automatically; mark state.
    emit({ outcome: 'downloading', version: info?.version, timestamp: nowIso() });
  });

  autoUpdater.on('update-not-available', () => {
    checkInFlight = false;
    emit({ outcome: 'up-to-date', timestamp: nowIso() });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    downloadedVersion = info?.version ?? null;
    emit({
      outcome: 'downloaded',
      version: info?.version,
      timestamp: nowIso(),
    });
  });

  autoUpdater.on('error', (err) => {
    checkInFlight = false;
    const message = plainError(err);
    console.error('[auto-update] error:', message);
    emit({ outcome: 'error', message, timestamp: nowIso() });
  });

  if (autoCheck) {
    void checkForUpdates();
    schedulePolling();
  }
}

function schedulePolling(): void {
  if (pollInterval) return;
  // 4-hour cadence matches the pre-existing behavior and the spec's
  // "quiet by default" tone — no aggressive retries.
  pollInterval = setInterval(() => {
    void checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}

/**
 * Trigger an update check. Guards against concurrent invocations
 * (S85: "does not fire a duplicate request").
 * Returns true if a check was initiated, false if one was already
 * in flight.
 */
export async function checkForUpdates(): Promise<boolean> {
  if (checkInFlight) return false;
  checkInFlight = true;
  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch (err) {
    checkInFlight = false;
    const message = plainError(err);
    emit({ outcome: 'error', message, timestamp: nowIso() });
    return true; // a check was initiated; it just failed fast
  }
}

/**
 * Apply a channel change. Persists the choice (caller is responsible)
 * and updates the live updater so the next check uses the new feed.
 */
export function applyChannel(channel: UpdateChannel): void {
  autoUpdater.allowPrerelease = channelToPrereleaseFlag(channel);
  autoUpdater.channel = channelToUpdaterName(channel);
}

export function isCheckInFlight(): boolean {
  return checkInFlight;
}

export function isUpdateDownloaded(): boolean {
  return updateDownloaded;
}

export function getDownloadedVersion(): string | null {
  return downloadedVersion;
}

/**
 * Trigger quit-and-install. Used by the S89 quit-prompt flow and the
 * S88 toast "Quit and install" action.
 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Subscribe to update events in-process (main-process consumers: menu
 * state, quit handler). Renderer consumers use IPC instead.
 */
export function onUpdateEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Broadcast the current cached state to a window that just attached —
 * ensures the renderer's Settings view sees the last-check status
 * (which is also in prefs, but this keeps the IPC contract consistent).
 */
export function broadcastCurrentTo(win: BrowserWindow): void {
  if (checkInFlight) {
    win.webContents.send('update-event', { outcome: 'checking', timestamp: nowIso() });
  }
}
