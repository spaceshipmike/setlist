// @fctry: #bootstrap-primitive-composition
//
// Tests for the recipe data model — bootstrap primitives + per-type recipe
// steps (spec 0.28, schema v14, S139 + foundational coverage for S140/S141).

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDb, SCHEMA_VERSION } from '../src/db.js';
import {
  listPrimitives,
  getPrimitive,
  getBuiltinPrimitiveByKey,
  createCustomPrimitive,
  updateCustomPrimitive,
  deleteCustomPrimitive,
  getRecipe,
  replaceRecipe,
  appendRecipeStep,
  snapshotRecipe,
  countRecipeReferences,
  listReferencingTypes,
  BUILTIN_PRIMITIVE_KEYS,
} from '../src/recipes/store.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

let dbPath: string;
let tmpDir: string;
let db: Database.Database;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'setlist-recipes-'));
  dbPath = join(tmpDir, 'registry.db');
  initDb(dbPath);
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
});

describe('Schema v16', () => {
  it('reports SCHEMA_VERSION = 16', () => {
    expect(SCHEMA_VERSION).toBe(16);
  });

  it('has bootstrap_primitives table', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bootstrap_primitives'`)
      .all();
    expect(tables.length).toBe(1);
  });

  it('has project_type_recipe_steps table', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='project_type_recipe_steps'`)
      .all();
    expect(tables.length).toBe(1);
  });

  it('records schema_version = 16 in schema_meta', () => {
    const row = db
      .prepare(`SELECT value FROM schema_meta WHERE key = 'schema_version'`)
      .get() as { value: string };
    expect(row.value).toBe('16');
  });

  it('has email_account column on projects (NULL for fresh-init existing-pattern test)', () => {
    const cols = db
      .prepare(`PRAGMA table_info(projects)`)
      .all() as { name: string }[];
    expect(cols.some((c) => c.name === 'email_account')).toBe(true);
  });
});

describe('Built-in primitives seed', () => {
  it('seeds all four built-ins on a fresh database', () => {
    const all = listPrimitives(db);
    const builtins = all.filter((p) => p.is_builtin);
    expect(builtins.length).toBe(4);
    const keys = builtins.map((p) => p.builtin_key).sort();
    expect(keys).toEqual([...BUILTIN_PRIMITIVE_KEYS].sort());
  });

  it('seed is idempotent — re-running initDb does not duplicate', () => {
    db.close();
    initDb(dbPath); // re-init on the same db
    db = new Database(dbPath);
    const all = listPrimitives(db);
    const builtins = all.filter((p) => p.is_builtin);
    expect(builtins.length).toBe(4);
  });

  it('built-in primitives have parsed definitions matching their shape', () => {
    const cf = getBuiltinPrimitiveByKey(db, 'create-folder');
    expect(cf?.shape).toBe('filesystem-op');
    expect(cf?.definition.shape).toBe('filesystem-op');

    const gi = getBuiltinPrimitiveByKey(db, 'git-init');
    expect(gi?.shape).toBe('shell-command');
    expect(gi?.definition.shape).toBe('shell-command');
    if (gi?.definition.shape === 'shell-command') {
      expect(gi.definition.command).toContain('git init');
    }
  });
});

describe('Built-in recipe seeds', () => {
  it('Code project recipe has the four built-ins in correct order', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const recipe = getRecipe(db, codeType.id);
    const keys = recipe.steps.map((s) => s.primitive.builtin_key);
    expect(keys).toEqual(['create-folder', 'copy-template', 'git-init', 'update-parent-gitignore']);
  });

  it('Non-code project recipe omits git-init', () => {
    const ncType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Non-code project'`)
      .get() as { id: number };
    const recipe = getRecipe(db, ncType.id);
    const keys = recipe.steps.map((s) => s.primitive.builtin_key);
    expect(keys).toEqual(['create-folder', 'copy-template', 'update-parent-gitignore']);
  });

  it('recipe positions are 0-indexed and contiguous', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const recipe = getRecipe(db, codeType.id);
    expect(recipe.steps.map((s) => s.position)).toEqual([0, 1, 2, 3]);
  });
});

describe('Custom primitive CRUD', () => {
  it('creates a custom mcp-tool primitive (S139)', () => {
    const p = createCustomPrimitive(db, {
      name: 'Create Todoist project',
      description: 'Creates a Todoist project named after the new setlist project',
      definition: {
        shape: 'mcp-tool',
        toolName: 'mcp__asst-tools__todoist_create_task',
        defaults: { content: '{project.name}' },
      },
    });
    expect(p.id).toBeGreaterThan(0);
    expect(p.is_builtin).toBe(false);
    expect(p.builtin_key).toBeNull();
    expect(p.shape).toBe('mcp-tool');
    if (p.definition.shape === 'mcp-tool') {
      expect(p.definition.toolName).toBe('mcp__asst-tools__todoist_create_task');
      expect(p.definition.defaults?.content).toBe('{project.name}');
    }
  });

  it('rejects edits to built-in primitives (S140)', () => {
    const builtin = getBuiltinPrimitiveByKey(db, 'create-folder')!;
    expect(() =>
      updateCustomPrimitive(db, builtin.id, { name: 'Renamed builtin' }),
    ).toThrow(/cannot be edited/);
  });

  it('rejects deletes of built-in primitives (S140)', () => {
    const builtin = getBuiltinPrimitiveByKey(db, 'git-init')!;
    expect(() => deleteCustomPrimitive(db, builtin.id)).toThrow(/cannot be deleted/);
  });

  it('updates a custom primitive', () => {
    const p = createCustomPrimitive(db, {
      name: 'direnv allow',
      description: 'Runs direnv allow inside the new project folder',
      definition: {
        shape: 'shell-command',
        command: 'direnv allow',
        workingDirectory: '{project.path}',
      },
    });
    const updated = updateCustomPrimitive(db, p.id, {
      description: 'Activates direnv',
    });
    expect(updated.description).toBe('Activates direnv');
    expect(updated.name).toBe('direnv allow'); // unchanged
  });

  it('deletes a custom primitive when no recipes reference it', () => {
    const p = createCustomPrimitive(db, {
      name: 'unused tool',
      description: '',
      definition: { shape: 'shell-command', command: 'true' },
    });
    deleteCustomPrimitive(db, p.id);
    expect(getPrimitive(db, p.id)).toBeNull();
  });

  it('blocks delete when a recipe references the primitive', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const p = createCustomPrimitive(db, {
      name: 'echo hi',
      description: '',
      definition: { shape: 'shell-command', command: 'echo hi' },
    });
    appendRecipeStep(db, codeType.id, p.id, {});
    expect(() => deleteCustomPrimitive(db, p.id)).toThrow(/referenced by/);
    expect(countRecipeReferences(db, p.id)).toBe(1);
    expect(listReferencingTypes(db, p.id)).toEqual(['Code project']);
  });
});

describe('Recipe operations', () => {
  it('replaceRecipe atomically swaps the full ordered list', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const cf = getBuiltinPrimitiveByKey(db, 'create-folder')!;
    const gi = getBuiltinPrimitiveByKey(db, 'git-init')!;
    const recipe = replaceRecipe(db, codeType.id, [
      { primitive_id: gi.id, params: { working_directory: '{project.path}' } },
      { primitive_id: cf.id, params: { path: '{project.path}' } },
    ]);
    expect(recipe.steps.length).toBe(2);
    expect(recipe.steps[0].primitive.builtin_key).toBe('git-init');
    expect(recipe.steps[1].primitive.builtin_key).toBe('create-folder');
    expect(recipe.steps[0].position).toBe(0);
    expect(recipe.steps[1].position).toBe(1);
  });

  it('appendRecipeStep adds at the end with correct position', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const before = getRecipe(db, codeType.id);
    const p = createCustomPrimitive(db, {
      name: 'post-hook',
      description: '',
      definition: { shape: 'shell-command', command: 'true' },
    });
    const step = appendRecipeStep(db, codeType.id, p.id, { foo: 'bar' });
    expect(step.position).toBe(before.steps.length);
    const after = getRecipe(db, codeType.id);
    expect(after.steps.length).toBe(before.steps.length + 1);
    expect(after.steps[after.steps.length - 1].params.foo).toBe('bar');
  });

  it('empty recipes are valid (S141)', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const empty = replaceRecipe(db, codeType.id, []);
    expect(empty.steps.length).toBe(0);
    const reloaded = getRecipe(db, codeType.id);
    expect(reloaded.steps.length).toBe(0);
  });

  it('snapshotRecipe captures the current state with a timestamp', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const snap = snapshotRecipe(db, codeType.id);
    expect(snap.project_type_id).toBe(codeType.id);
    expect(snap.steps.length).toBe(4);
    expect(snap.snapshot_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('two project types can bind the same custom primitive with different params', () => {
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    const ncType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Non-code project'`)
      .get() as { id: number };
    const p = createCustomPrimitive(db, {
      name: 'shared tool',
      description: '',
      definition: { shape: 'shell-command', command: 'echo {project.name}' },
    });
    appendRecipeStep(db, codeType.id, p.id, { working_directory: '/code' });
    appendRecipeStep(db, ncType.id, p.id, { working_directory: '/projects' });
    const codeRecipe = getRecipe(db, codeType.id);
    const ncRecipe = getRecipe(db, ncType.id);
    const codeStep = codeRecipe.steps.find((s) => s.primitive_id === p.id)!;
    const ncStep = ncRecipe.steps.find((s) => s.primitive_id === p.id)!;
    expect(codeStep.params.working_directory).toBe('/code');
    expect(ncStep.params.working_directory).toBe('/projects');
    // Same primitive, different params per recipe — primitive itself unchanged.
    expect(codeStep.primitive.id).toBe(ncStep.primitive.id);
  });
});

// Cleanup
import { afterEach } from 'vitest';
afterEach(() => {
  try {
    db.close();
  } catch { /* already closed */ }
  rmSync(tmpDir, { recursive: true, force: true });
});
