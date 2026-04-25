// @fctry: #entities
//
// Area definitions and seed data for user-managed areas (spec 0.26, schema v13).
//
// Areas were system-owned in spec 0.13–0.25 (the "canonical seven"). Spec 0.26
// promotes them to first-class user-managed entities with full CRUD via the
// Settings panel. The seven canonical names are now seed defaults — they are
// the rows that exist when a brand-new database is created — but the user
// is free to rename, recolor, add, or delete them (subject to the
// AREA_HAS_PROJECTS guard).

import type Database from 'better-sqlite3';

/** A row in the `areas` table. */
export interface AreaRow {
  id: number;
  name: string;
  display_name: string;
  description: string;
  color: string;
}

/**
 * Curated 12-color palette for areas and project types (spec 0.26 §2.14).
 * The Settings UI renders these as a click-to-select grid.
 */
export const AREA_COLOR_PALETTE: readonly string[] = Object.freeze([
  '#3b82f6', // blue
  '#ec4899', // pink
  '#10b981', // emerald
  '#ef4444', // red
  '#f59e0b', // amber
  '#a855f7', // purple
  '#6b7280', // gray
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#8b5cf6', // violet
]);

/**
 * Seed defaults for the `areas` table — used only on a fresh database.
 * After initial seed, areas are user-owned and may be renamed, recolored,
 * added, or deleted via the Settings panel.
 */
export const SEED_AREAS: { name: string; display_name: string; description: string; color: string }[] = [
  { name: 'Work',           display_name: 'Work',           description: 'Professional, client, and advisory projects.',     color: '#3b82f6' },
  { name: 'Family',         display_name: 'Family',         description: 'Household family coordination and planning.',      color: '#ec4899' },
  { name: 'Home',           display_name: 'Home',           description: 'Property, maintenance, and home operations.',      color: '#10b981' },
  { name: 'Health',         display_name: 'Health',         description: 'Physical and mental health, fitness, medical.',    color: '#ef4444' },
  { name: 'Finance',        display_name: 'Finance',        description: 'Money, banking, investment, tax, and accounting.', color: '#f59e0b' },
  { name: 'Personal',       display_name: 'Personal',       description: 'Personal development, hobbies, and creative work.', color: '#a855f7' },
  { name: 'Infrastructure', display_name: 'Infrastructure', description: 'Tooling, devops, and shared portfolio plumbing.',  color: '#6b7280' },
];

/**
 * Idempotent seed: insert the canonical seven if they don't already exist
 * by name. Never updates existing rows (the user owns them after init).
 */
export function seedAreas(db: Database.Database): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO areas (name, display_name, description, color) VALUES (?, ?, ?, ?)`
  );
  for (const area of SEED_AREAS) {
    stmt.run(area.name, area.display_name, area.description, area.color);
  }
}

/** Validate a color string against the curated palette. */
export function isValidAreaColor(color: string): boolean {
  return AREA_COLOR_PALETTE.includes(color);
}
