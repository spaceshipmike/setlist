// @fctry: #desktop-app
//
// Spec 0.26 §2.14: persistent renderer preferences for column visibility, row
// density, sort, and default landing view. Backed by localStorage so the app
// remembers them across launches without round-tripping to the registry.
//
// Read/write through the helpers below — direct localStorage access scattered
// across components leads to drift. The Settings panel and the FilterBar both
// read the same source of truth.

export type LandingView = 'grouped' | 'flat';
export type RowDensity = 'compact' | 'spacious';
export type SortKey = 'name' | 'updated_at' | 'type' | 'status' | 'health';
export type SortDir = 'asc' | 'desc';

/** Toggleable column keys. The Name column is fixed and not toggleable. */
export type ColumnKey = 'status' | 'health' | 'type' | 'updated_at' | 'area';

export interface ColumnVisibility {
  status: boolean;
  health: boolean;
  type: boolean;
  updated_at: boolean;
  area: boolean;
}

export const DEFAULT_COLUMNS: ColumnVisibility = {
  status: true,
  health: true,
  type: true,
  updated_at: true,
  area: true,
};

export const DEFAULT_DENSITY: RowDensity = 'spacious';
export const DEFAULT_LANDING: LandingView = 'grouped';
export const DEFAULT_SORT_KEY: SortKey = 'updated_at';
export const DEFAULT_SORT_DIR: SortDir = 'desc';

const KEYS = {
  columns: 'setlist.prefs.columns',
  density: 'setlist.prefs.density',
  landing: 'setlist.prefs.landing',
  sortKey: 'setlist.prefs.sortKey',
  sortDir: 'setlist.prefs.sortDir',
} as const;

function safeRead(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch { return null; }
}

function safeWrite(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

export function getColumns(): ColumnVisibility {
  const raw = safeRead(KEYS.columns);
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed = JSON.parse(raw) as Partial<ColumnVisibility>;
    return { ...DEFAULT_COLUMNS, ...parsed };
  } catch { return DEFAULT_COLUMNS; }
}

export function setColumns(next: ColumnVisibility): void {
  safeWrite(KEYS.columns, JSON.stringify(next));
}

export function getDensity(): RowDensity {
  const raw = safeRead(KEYS.density);
  return raw === 'compact' || raw === 'spacious' ? raw : DEFAULT_DENSITY;
}

export function setDensity(d: RowDensity): void { safeWrite(KEYS.density, d); }

export function getLanding(): LandingView {
  const raw = safeRead(KEYS.landing);
  return raw === 'grouped' || raw === 'flat' ? raw : DEFAULT_LANDING;
}

export function setLanding(v: LandingView): void { safeWrite(KEYS.landing, v); }

export function getSortKey(): SortKey {
  const raw = safeRead(KEYS.sortKey);
  if (raw === 'name' || raw === 'updated_at' || raw === 'type' || raw === 'status' || raw === 'health') return raw;
  return DEFAULT_SORT_KEY;
}

export function setSortKey(k: SortKey): void { safeWrite(KEYS.sortKey, k); }

export function getSortDir(): SortDir {
  const raw = safeRead(KEYS.sortDir);
  return raw === 'asc' || raw === 'desc' ? raw : DEFAULT_SORT_DIR;
}

export function setSortDir(d: SortDir): void { safeWrite(KEYS.sortDir, d); }
