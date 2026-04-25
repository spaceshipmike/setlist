// @fctry: #entities
//
// Project-type definitions and seed data for user-managed project types
// (spec 0.26, schema v13).
//
// Spec 0.13–0.25 hardcoded a single project type ("project") with a
// path-heuristic fallback ("contains /Code/" → code, else non-code).
// Spec 0.26 promotes project types to first-class user-managed entities,
// each with a default directory, git_init flag, optional template directory,
// and color. New projects choose a project_type_id; bootstrap reads the
// type's defaults to drive folder creation and git init.

import type Database from 'better-sqlite3';

/** A row in the `project_types` table. */
export interface ProjectTypeRow {
  id: number;
  name: string;
  default_directory: string;
  git_init: number; // SQLite stores booleans as 0/1
  template_directory: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
}

/** Project-type representation for library callers (booleans, not 0/1). */
export interface ProjectType {
  id: number;
  name: string;
  default_directory: string;
  git_init: boolean;
  template_directory: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Seed defaults for the `project_types` table — used only on a fresh database
 * (or on the first run after the v12→v13 migration). After seed, project
 * types are user-owned.
 */
export const SEED_PROJECT_TYPES: {
  name: string;
  default_directory: string;
  git_init: number;
  template_directory: string | null;
  color: string | null;
}[] = [
  {
    name: 'Code project',
    default_directory: '~/Code',
    git_init: 1,
    template_directory: null,
    color: '#3b82f6',
  },
  {
    name: 'Non-code project',
    default_directory: '~/Projects',
    git_init: 0,
    template_directory: null,
    color: '#a855f7',
  },
];

/**
 * Idempotent seed: insert the two defaults if they don't already exist
 * by name.
 */
export function seedProjectTypes(db: Database.Database): void {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO project_types
       (name, default_directory, git_init, template_directory, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of SEED_PROJECT_TYPES) {
    stmt.run(t.name, t.default_directory, t.git_init, t.template_directory, t.color, now, now);
  }
}

/** Convert a SQLite row to the public ProjectType representation. */
export function rowToProjectType(row: ProjectTypeRow): ProjectType {
  return {
    id: row.id,
    name: row.name,
    default_directory: row.default_directory,
    git_init: row.git_init === 1,
    template_directory: row.template_directory,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
