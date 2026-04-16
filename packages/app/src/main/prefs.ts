// @fctry: #auto-update
// User preferences storage for the desktop app.
// Persists durable, user-controlled state (update channel, last-check status)
// to a JSON file inside Electron's userData directory so choices survive
// quits, relaunches, and updates.
//
// This is deliberately dependency-free: a tiny typed wrapper around
// readFileSync / writeFileSync. All writes go through setPrefs() which
// serializes the full prefs object atomically (write to tmp + rename).

import { app } from 'electron';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export type UpdateChannel = 'stable' | 'beta';

export type UpdateOutcome =
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface LastCheck {
  timestamp: string; // ISO 8601
  outcome: UpdateOutcome;
  message?: string; // plain-language error or status detail
  version?: string; // version discovered, if any
}

export interface Prefs {
  update_channel: UpdateChannel;
  last_check: LastCheck | null;
}

const DEFAULTS: Prefs = {
  update_channel: 'stable',
  last_check: null,
};

let cached: Prefs | null = null;
let prefsPath: string | null = null;

function resolvePath(): string {
  if (prefsPath) return prefsPath;
  // app.getPath('userData') returns Electron's per-user data directory
  // (e.g., ~/Library/Application Support/Setlist on macOS).
  prefsPath = join(app.getPath('userData'), 'update-prefs.json');
  return prefsPath;
}

function merge(partial: Partial<Prefs>): Prefs {
  const base = cached ?? DEFAULTS;
  return {
    update_channel: partial.update_channel ?? base.update_channel,
    last_check: partial.last_check !== undefined ? partial.last_check : base.last_check,
  };
}

function isValidChannel(v: unknown): v is UpdateChannel {
  return v === 'stable' || v === 'beta';
}

function normalize(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const obj = raw as Record<string, unknown>;
  const channel = isValidChannel(obj.update_channel) ? obj.update_channel : DEFAULTS.update_channel;
  const last = obj.last_check;
  let lastCheck: LastCheck | null = null;
  if (last && typeof last === 'object') {
    const l = last as Record<string, unknown>;
    if (typeof l.timestamp === 'string' && typeof l.outcome === 'string') {
      lastCheck = {
        timestamp: l.timestamp,
        outcome: l.outcome as UpdateOutcome,
        ...(typeof l.message === 'string' ? { message: l.message } : {}),
        ...(typeof l.version === 'string' ? { version: l.version } : {}),
      };
    }
  }
  return { update_channel: channel, last_check: lastCheck };
}

/**
 * Load prefs from disk (or return defaults on first run / parse error).
 * Caches the result; subsequent calls are in-memory.
 */
export function loadPrefs(): Prefs {
  if (cached) return cached;
  const path = resolvePath();
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8');
      cached = normalize(JSON.parse(raw));
    } else {
      cached = { ...DEFAULTS };
    }
  } catch (err) {
    console.error('[prefs] Failed to load, using defaults:', err instanceof Error ? err.message : err);
    cached = { ...DEFAULTS };
  }
  return cached;
}

/**
 * Persist a partial update to disk. Writes atomically (tmp + rename) so
 * a crash mid-write cannot leave a half-written prefs file.
 */
export function setPrefs(partial: Partial<Prefs>): Prefs {
  const next = merge(partial);
  const path = resolvePath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    renameSync(tmp, path);
    cached = next;
  } catch (err) {
    console.error('[prefs] Failed to save:', err instanceof Error ? err.message : err);
    // Still update cache so session continues with intent; disk will retry on next setPrefs.
    cached = next;
  }
  return next;
}

export function getChannel(): UpdateChannel {
  return loadPrefs().update_channel;
}

export function setChannel(channel: UpdateChannel): Prefs {
  return setPrefs({ update_channel: channel });
}

export function getLastCheck(): LastCheck | null {
  return loadPrefs().last_check;
}

export function setLastCheck(check: LastCheck): Prefs {
  return setPrefs({ last_check: check });
}

/**
 * Test-only: reset the in-memory cache and (optionally) override the
 * file path. Not exported from the main module barrel.
 */
export function __resetForTests(path?: string): void {
  cached = null;
  prefsPath = path ?? null;
}
