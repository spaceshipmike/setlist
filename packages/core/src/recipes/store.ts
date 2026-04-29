// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: bootstrap primitives + recipe storage.
//
// CRUD helpers around `bootstrap_primitives` and `project_type_recipe_steps`,
// plus the seed function for the four read-only built-in primitives. Built-in
// primitives are seeded idempotently on a fresh database and on the v13→v14
// migration; their `is_builtin=1` flag makes them un-editable and un-deletable
// at the API level (enforced by these helpers).

import type Database from 'better-sqlite3';
import type {
  Primitive,
  PrimitiveDefinition,
  PrimitiveRow,
  PrimitiveShape,
  Recipe,
  RecipeStep,
  RecipeStepRow,
  RecipeSnapshot,
  BuiltinPrimitiveKey,
} from './types.js';
import { BUILTIN_PRIMITIVE_KEYS } from './types.js';

/**
 * Shell command for the `mail-create-mailbox` built-in primitive (spec 0.29).
 *
 * Runs an AppleScript via heredoc that:
 * - Resolves the account by name, splits the path on `/`, and walks each
 *   segment, creating mailboxes that don't exist and traversing into ones
 *   that do (silent idempotence on duplicate paths — S163).
 * - Errors verbatim (unknown account, etc.) come back through stderr and
 *   are surfaced as Step-failed in the Retry/Skip/Abandon dialog (S161).
 *
 * The `{account}` and `{mailbox_path}` placeholders are substituted from the
 * recipe step's resolved_params before the shell executor's project-token
 * pass runs (see executors/shell.ts).
 */
// `{{...}}` escapes the literal `{...}` so the project-token resolver leaves
// AppleScript record syntax (e.g. `{name:segName}`) intact. The shell
// executor's param-substitution pass runs first, replacing `{account}` and
// `{mailbox_path}` with the resolved values; then the project-token pass
// runs, decoding `{{` → `{` and `}}` → `}` for the literal AppleScript braces.
export const MAIL_CREATE_MAILBOX_COMMAND = String.raw`osascript - "{account}" "{mailbox_path}" <<'OSAEND'
on run argv
  set acctName to item 1 of argv
  set fullPath to item 2 of argv
  tell application "Mail"
    set targetAccount to first account whose name is acctName
    set AppleScript's text item delimiters to "/"
    set segs to text items of fullPath
    set AppleScript's text item delimiters to ""
    set parentRef to targetAccount
    repeat with seg in segs
      set segName to seg as string
      if segName is not "" then
        try
          set parentRef to mailbox segName of parentRef
        on error
          set parentRef to (make new mailbox with properties {{name:segName} at parentRef)
        end try
      end if
    end repeat
  end tell
end run
OSAEND`;

/**
 * The five built-in primitives that ship with setlist. Definitions of the
 * first four match the v0.27 hardcoded behavior so seeded recipes reproduce
 * pre-evolve semantics; `mail-create-mailbox` (spec 0.29) is the fifth and
 * is seeded but NOT in any default recipe (S164).
 */
const BUILTIN_PRIMITIVES: {
  builtin_key: BuiltinPrimitiveKey;
  name: string;
  description: string;
  shape: PrimitiveShape;
  definition: PrimitiveDefinition;
}[] = [
  {
    builtin_key: 'create-folder',
    name: 'Create folder',
    description: 'Creates the project folder at the resolved path (mkdir -p).',
    shape: 'filesystem-op',
    definition: {
      shape: 'filesystem-op',
      operation: 'create-folder',
      defaults: { path: '{project.path}' },
    },
  },
  {
    builtin_key: 'copy-template',
    name: 'Copy template',
    description: 'Copies the project type\'s template directory into the new project folder.',
    shape: 'filesystem-op',
    definition: {
      shape: 'filesystem-op',
      operation: 'copy-template',
      defaults: { source: '{project.type.template_directory}', destination: '{project.path}' },
    },
  },
  {
    builtin_key: 'git-init',
    name: 'Git init',
    description: 'Initializes a git repository inside the project folder and makes an initial commit.',
    shape: 'shell-command',
    definition: {
      shape: 'shell-command',
      command: 'git init -q && git add . && git commit -q -m "Initial project scaffold from bootstrap_project" --allow-empty',
      workingDirectory: '{project.path}',
    },
  },
  {
    builtin_key: 'update-parent-gitignore',
    name: 'Update parent .gitignore',
    description: 'Appends the project folder name to the parent directory\'s .gitignore (if the parent is a git repo).',
    shape: 'filesystem-op',
    definition: {
      shape: 'filesystem-op',
      operation: 'append-to-file',
      defaults: { path: '{project.parent_path}/.gitignore', line: '{project.name}/' },
    },
  },
  // Spec 0.29 (S155–S168): mail-create-mailbox is a shell-command built-in
  // that drives Mail.app via osascript to create a nested mailbox under a
  // named account. Seeded but NOT in any default recipe — the user opts in
  // by adding it to a project type's recipe in Settings (S164).
  //
  // The AppleScript:
  //   - Splits the resolved mailbox path on "/" into parent/leaf segments
  //     so Mail.app's nested-mailbox convention (mailbox-of-mailbox) is
  //     honored: "Projects/alpha" creates mailbox `alpha` under `Projects`.
  //   - Walks segments, creating each missing parent on the way down. If
  //     every segment already exists, the script is a no-op and exits 0
  //     (S163: silent idempotence on duplicate names).
  //   - Returns no stdout on success; on unknown-account or other Mail.app
  //     errors, osascript exits non-zero with the error on stderr — the
  //     shell executor surfaces it verbatim through Retry/Skip/Abandon (S161).
  //
  // No setlist-managed credentials: Mail.app's running session is the trust
  // boundary. Closed three-shape invariant preserved (this is shell-command,
  // not a new shape).
  {
    builtin_key: 'mail-create-mailbox',
    name: 'Create Mail.app mailbox',
    description:
      "Creates a nested mailbox under the resolved Mail.app account at the resolved path. Idempotent on duplicate names. Mail.app must be running; setlist does not auto-launch it.",
    shape: 'shell-command',
    definition: {
      shape: 'shell-command',
      command: MAIL_CREATE_MAILBOX_COMMAND,
      workingDirectory: '{project.path}',
    },
  },
];

/** Seeded recipe binding for the 'Code project' built-in type. */
const SEED_CODE_RECIPE: BuiltinPrimitiveKey[] = [
  'create-folder',
  'copy-template',
  'git-init',
  'update-parent-gitignore',
];

/** Seeded recipe binding for the 'Non-code project' built-in type. */
const SEED_NON_CODE_RECIPE: BuiltinPrimitiveKey[] = [
  'create-folder',
  'copy-template',
  'update-parent-gitignore',
];

/** Convert a SQLite row to the public Primitive representation. */
export function rowToPrimitive(row: PrimitiveRow): Primitive {
  let definition: PrimitiveDefinition;
  try {
    definition = JSON.parse(row.definition_json) as PrimitiveDefinition;
  } catch {
    // Defensive fallback — corrupted JSON should not crash recall.
    definition = { shape: row.shape } as PrimitiveDefinition;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    shape: row.shape,
    is_builtin: row.is_builtin === 1,
    builtin_key: row.builtin_key,
    definition,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Convert a recipe-step row + its primitive to the public RecipeStep shape. */
export function rowToRecipeStep(row: RecipeStepRow, primitive: Primitive): RecipeStep {
  let params: Record<string, string> = {};
  try {
    const parsed = JSON.parse(row.params_json);
    if (parsed && typeof parsed === 'object') {
      params = parsed as Record<string, string>;
    }
  } catch {
    // Corrupted JSON falls back to empty params.
  }
  return {
    id: row.id,
    project_type_id: row.project_type_id,
    position: row.position,
    primitive_id: row.primitive_id,
    primitive,
    params,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Seed the four built-in primitives. Idempotent: re-running on a database
 * that already contains them is a no-op.
 *
 * Built-ins are matched by `builtin_key`, not by `name`, so a user renaming
 * a built-in (which is blocked at the API level but defensive here) does not
 * reseed a duplicate.
 */
export function seedBuiltinPrimitives(db: Database.Database): void {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO bootstrap_primitives
       (name, description, shape, is_builtin, builtin_key, definition_json, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
  );
  for (const p of BUILTIN_PRIMITIVES) {
    stmt.run(
      p.name,
      p.description,
      p.shape,
      p.builtin_key,
      JSON.stringify(p.definition),
      now,
      now,
    );
  }
}

/**
 * Bind the seeded built-in recipes to the two seeded project types
 * (Code project, Non-code project). Idempotent: only runs if the type's
 * recipe is currently empty.
 *
 * This makes the v13→v14 migration faithful to v0.27 behavior — a fresh
 * install (or an upgrade) of a Code project bootstraps with exactly the
 * same four steps as before, just expressed as recipe rows.
 */
export function seedBuiltinRecipes(db: Database.Database): void {
  const now = Math.floor(Date.now() / 1000);
  const codeType = db
    .prepare(`SELECT id FROM project_types WHERE name = ?`)
    .get('Code project') as { id: number } | undefined;
  const nonCodeType = db
    .prepare(`SELECT id FROM project_types WHERE name = ?`)
    .get('Non-code project') as { id: number } | undefined;

  function bindRecipe(typeId: number, keys: BuiltinPrimitiveKey[]): void {
    const existing = db
      .prepare(`SELECT COUNT(*) AS n FROM project_type_recipe_steps WHERE project_type_id = ?`)
      .get(typeId) as { n: number };
    if (existing.n > 0) return; // user has already customized — leave it alone.

    const insert = db.prepare(
      `INSERT INTO project_type_recipe_steps
         (project_type_id, position, primitive_id, params_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const prim = db
        .prepare(`SELECT id, definition_json FROM bootstrap_primitives WHERE builtin_key = ? AND is_builtin = 1`)
        .get(key) as { id: number; definition_json: string } | undefined;
      if (!prim) continue;
      // Bind the primitive's defaults as the recipe step's initial params.
      let defaults: Record<string, string> = {};
      try {
        const def = JSON.parse(prim.definition_json) as PrimitiveDefinition;
        if (def.shape === 'filesystem-op' && def.defaults) {
          defaults = { ...def.defaults };
        } else if (def.shape === 'shell-command') {
          // Shell-command's command is fixed by the primitive; the recipe
          // step only carries working_directory + env binding overrides.
          if (def.workingDirectory) defaults.working_directory = def.workingDirectory;
        } else if (def.shape === 'mcp-tool' && def.defaults) {
          defaults = { ...def.defaults };
        }
      } catch {
        // empty defaults
      }
      insert.run(typeId, i, prim.id, JSON.stringify(defaults), now, now);
    }
  }

  if (codeType) bindRecipe(codeType.id, SEED_CODE_RECIPE);
  if (nonCodeType) bindRecipe(nonCodeType.id, SEED_NON_CODE_RECIPE);
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export function listPrimitives(db: Database.Database): Primitive[] {
  const rows = db
    .prepare(
      `SELECT id, name, description, shape, is_builtin, builtin_key, definition_json,
              created_at, updated_at
       FROM bootstrap_primitives
       ORDER BY is_builtin DESC, name ASC`,
    )
    .all() as PrimitiveRow[];
  return rows.map(rowToPrimitive);
}

export function getPrimitive(db: Database.Database, id: number): Primitive | null {
  const row = db
    .prepare(
      `SELECT id, name, description, shape, is_builtin, builtin_key, definition_json,
              created_at, updated_at
       FROM bootstrap_primitives WHERE id = ?`,
    )
    .get(id) as PrimitiveRow | undefined;
  return row ? rowToPrimitive(row) : null;
}

export function getBuiltinPrimitiveByKey(
  db: Database.Database,
  key: BuiltinPrimitiveKey,
): Primitive | null {
  const row = db
    .prepare(
      `SELECT id, name, description, shape, is_builtin, builtin_key, definition_json,
              created_at, updated_at
       FROM bootstrap_primitives WHERE builtin_key = ? AND is_builtin = 1`,
    )
    .get(key) as PrimitiveRow | undefined;
  return row ? rowToPrimitive(row) : null;
}

export interface CreatePrimitiveOpts {
  name: string;
  description: string;
  definition: PrimitiveDefinition;
}

export function createCustomPrimitive(
  db: Database.Database,
  opts: CreatePrimitiveOpts,
): Primitive {
  const now = Math.floor(Date.now() / 1000);
  const result = db
    .prepare(
      `INSERT INTO bootstrap_primitives
         (name, description, shape, is_builtin, builtin_key, definition_json, created_at, updated_at)
       VALUES (?, ?, ?, 0, NULL, ?, ?, ?)`,
    )
    .run(opts.name, opts.description, opts.definition.shape, JSON.stringify(opts.definition), now, now);

  const id = Number(result.lastInsertRowid);
  return getPrimitive(db, id)!;
}

export interface UpdatePrimitiveOpts {
  name?: string;
  description?: string;
  definition?: PrimitiveDefinition;
}

/**
 * Update a custom primitive. Throws when called on a built-in (built-ins are
 * read-only in shape, but bindable in parameters via recipe steps).
 */
export function updateCustomPrimitive(
  db: Database.Database,
  id: number,
  opts: UpdatePrimitiveOpts,
): Primitive {
  const existing = getPrimitive(db, id);
  if (!existing) throw new Error(`Primitive ${id} not found`);
  if (existing.is_builtin) {
    throw new Error('Built-in primitives cannot be edited (read-only in shape)');
  }
  const now = Math.floor(Date.now() / 1000);
  const next = {
    name: opts.name ?? existing.name,
    description: opts.description ?? existing.description,
    shape: opts.definition?.shape ?? existing.shape,
    definition_json: opts.definition
      ? JSON.stringify(opts.definition)
      : JSON.stringify(existing.definition),
  };
  db.prepare(
    `UPDATE bootstrap_primitives
     SET name = ?, description = ?, shape = ?, definition_json = ?, updated_at = ?
     WHERE id = ?`,
  ).run(next.name, next.description, next.shape, next.definition_json, now, id);
  return getPrimitive(db, id)!;
}

/**
 * Delete a custom primitive. Throws when called on a built-in. Throws when
 * any project type's recipe references this primitive (the caller surfaces
 * the referencing types).
 */
export function deleteCustomPrimitive(db: Database.Database, id: number): void {
  const existing = getPrimitive(db, id);
  if (!existing) throw new Error(`Primitive ${id} not found`);
  if (existing.is_builtin) {
    throw new Error('Built-in primitives cannot be deleted');
  }
  const refs = db
    .prepare(`SELECT COUNT(*) AS n FROM project_type_recipe_steps WHERE primitive_id = ?`)
    .get(id) as { n: number };
  if (refs.n > 0) {
    throw new Error(
      `Primitive ${existing.name} is referenced by ${refs.n} recipe step(s); remove those bindings first`,
    );
  }
  db.prepare(`DELETE FROM bootstrap_primitives WHERE id = ?`).run(id);
}

/** Count of recipe steps referencing a primitive — used by the UI's delete dialog. */
export function countRecipeReferences(db: Database.Database, primitiveId: number): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM project_type_recipe_steps WHERE primitive_id = ?`)
    .get(primitiveId) as { n: number };
  return row.n;
}

/** Names of the project types whose recipes reference this primitive. */
export function listReferencingTypes(db: Database.Database, primitiveId: number): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT pt.name AS name
       FROM project_type_recipe_steps s
       JOIN project_types pt ON pt.id = s.project_type_id
       WHERE s.primitive_id = ?
       ORDER BY pt.name ASC`,
    )
    .all(primitiveId) as { name: string }[];
  return rows.map((r) => r.name);
}

// ---------------------------------------------------------------------------
// Recipe CRUD
// ---------------------------------------------------------------------------

/** Get a project type's full ordered recipe (excludes the trailer). */
export function getRecipe(db: Database.Database, projectTypeId: number): Recipe {
  const stepRows = db
    .prepare(
      `SELECT id, project_type_id, position, primitive_id, params_json, created_at, updated_at
       FROM project_type_recipe_steps
       WHERE project_type_id = ?
       ORDER BY position ASC`,
    )
    .all(projectTypeId) as RecipeStepRow[];

  const steps: RecipeStep[] = [];
  for (const row of stepRows) {
    const prim = getPrimitive(db, row.primitive_id);
    if (!prim) continue; // Defensive: primitive was deleted out from under us.
    steps.push(rowToRecipeStep(row, prim));
  }
  return { project_type_id: projectTypeId, steps };
}

/**
 * Replace a project type's full recipe atomically. Existing rows are deleted
 * and the new ordered list inserted. Positions are renumbered 0..N-1.
 */
export function replaceRecipe(
  db: Database.Database,
  projectTypeId: number,
  steps: { primitive_id: number; params: Record<string, string> }[],
): Recipe {
  const now = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM project_type_recipe_steps WHERE project_type_id = ?`).run(projectTypeId);
    const insert = db.prepare(
      `INSERT INTO project_type_recipe_steps
         (project_type_id, position, primitive_id, params_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < steps.length; i++) {
      insert.run(projectTypeId, i, steps[i].primitive_id, JSON.stringify(steps[i].params), now, now);
    }
  });
  tx();
  return getRecipe(db, projectTypeId);
}

/** Append one step to the end of a recipe and return the new step. */
export function appendRecipeStep(
  db: Database.Database,
  projectTypeId: number,
  primitiveId: number,
  params: Record<string, string>,
): RecipeStep {
  const max = db
    .prepare(
      `SELECT COALESCE(MAX(position), -1) AS p FROM project_type_recipe_steps WHERE project_type_id = ?`,
    )
    .get(projectTypeId) as { p: number };
  const now = Math.floor(Date.now() / 1000);
  const result = db
    .prepare(
      `INSERT INTO project_type_recipe_steps
         (project_type_id, position, primitive_id, params_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(projectTypeId, max.p + 1, primitiveId, JSON.stringify(params), now, now);
  const id = Number(result.lastInsertRowid);
  const row = db
    .prepare(
      `SELECT id, project_type_id, position, primitive_id, params_json, created_at, updated_at
       FROM project_type_recipe_steps WHERE id = ?`,
    )
    .get(id) as RecipeStepRow;
  const prim = getPrimitive(db, primitiveId);
  if (!prim) throw new Error(`Primitive ${primitiveId} not found`);
  return rowToRecipeStep(row, prim);
}

/** Take a snapshot of the current recipe — used by the bootstrap engine at start. */
export function snapshotRecipe(db: Database.Database, projectTypeId: number): RecipeSnapshot {
  const recipe = getRecipe(db, projectTypeId);
  return {
    project_type_id: projectTypeId,
    steps: recipe.steps,
    snapshot_at: new Date().toISOString(),
  };
}

export { BUILTIN_PRIMITIVE_KEYS };
