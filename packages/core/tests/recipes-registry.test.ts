// @fctry: #bootstrap-primitive-composition
//
// Tests for PrimitivesRegistry (the public class wrapping store.ts) and
// the template-token resolver. Spec 0.28, S140 + S153 foundation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  PrimitivesRegistry,
  resolveTemplate,
  resolveParams,
  EXAMPLE_CONTEXT,
  newCleanupLog,
  NULL_MCP_CALLER,
  TRAILER_NAME,
  TRAILER_LABEL,
} from '../src/index.js';
import Database from 'better-sqlite3';

let tmpDir: string;
let dbPath: string;
let registry: PrimitivesRegistry;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'setlist-prim-reg-'));
  dbPath = join(tmpDir, 'registry.db');
  registry = new PrimitivesRegistry(dbPath);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PrimitivesRegistry', () => {
  it('lists the five built-ins on a fresh registry (S164)', () => {
    const all = registry.listPrimitives();
    const builtins = all.filter((p) => p.is_builtin);
    expect(builtins.length).toBe(5);
  });

  it('returns null for getPrimitive on unknown id', () => {
    expect(registry.getPrimitive(99999)).toBeNull();
  });

  it('returns the create-folder built-in by key', () => {
    const cf = registry.getBuiltinByKey('create-folder');
    expect(cf).not.toBeNull();
    expect(cf!.shape).toBe('filesystem-op');
    expect(cf!.is_builtin).toBe(true);
  });

  it('createPrimitive + updatePrimitive + deletePrimitive round-trip (custom)', () => {
    const created = registry.createPrimitive({
      name: 'echo greeting',
      description: 'echoes a greeting',
      definition: { shape: 'shell-command', command: 'echo hello' },
    });
    expect(created.is_builtin).toBe(false);
    expect(created.id).toBeGreaterThan(0);

    const updated = registry.updatePrimitive(created.id, {
      description: 'updated desc',
    });
    expect(updated.description).toBe('updated desc');

    registry.deletePrimitive(created.id);
    expect(registry.getPrimitive(created.id)).toBeNull();
  });

  it('blocks update on a built-in (S140)', () => {
    const cf = registry.getBuiltinByKey('create-folder')!;
    expect(() => registry.updatePrimitive(cf.id, { name: 'renamed' })).toThrow(/cannot be edited/);
  });

  it('blocks delete on a built-in (S140)', () => {
    const cf = registry.getBuiltinByKey('create-folder')!;
    expect(() => registry.deletePrimitive(cf.id)).toThrow(/cannot be deleted/);
  });

  it('blocks delete when recipes reference the primitive, surfaces referencing types', () => {
    const db = new Database(dbPath);
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    db.close();

    const created = registry.createPrimitive({
      name: 'shared-step',
      description: '',
      definition: { shape: 'shell-command', command: 'true' },
    });
    registry.appendStep(codeType.id, created.id, {});
    expect(registry.countReferences(created.id)).toBe(1);
    expect(registry.listReferencingTypes(created.id)).toEqual(['Code project']);
    expect(() => registry.deletePrimitive(created.id)).toThrow(/referenced by/);
  });

  it('snapshotRecipe returns a non-empty Code-project recipe with timestamp', () => {
    const db = new Database(dbPath);
    const codeType = db
      .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
      .get() as { id: number };
    db.close();
    const snap = registry.snapshotRecipe(codeType.id);
    expect(snap.steps.length).toBe(4);
    expect(snap.snapshot_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Template resolver', () => {
  const ctx = {
    name: 'space-tracker-v2',
    path: '/Users/x/Code/space-tracker-v2',
    type: 'Code project',
    parent_path: '/Users/x/Code',
    template_directory: '/Users/x/Templates/code',
  };

  it('resolves project.name', () => {
    const r = resolveTemplate('Hello {project.name}!', ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('Hello space-tracker-v2!');
  });

  it('resolves multiple tokens in one string', () => {
    const r = resolveTemplate('{project.path}/notes.md ({project.type})', ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('/Users/x/Code/space-tracker-v2/notes.md (Code project)');
  });

  it('handles literal braces via {{', () => {
    const r = resolveTemplate('echo "{{literal}}" and {project.name}', ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('echo "{literal}}" and space-tracker-v2');
  });

  it('flags an unknown token as resolution failure (not crash)', () => {
    const r = resolveTemplate('{projct.name}', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('unknown-token');
      expect(r.token).toBe('projct.name');
    }
  });

  it('flags malformed brace (missing closing })', () => {
    const r = resolveTemplate('hello {project.name', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('malformed-brace');
  });

  it('resolves project.parent_path', () => {
    const r = resolveTemplate('{project.parent_path}/.gitignore', ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('/Users/x/Code/.gitignore');
  });

  it('resolves project.type.template_directory (empty when null)', () => {
    const r = resolveTemplate('{project.type.template_directory}', { ...ctx, template_directory: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('');
  });

  it('resolveParams returns success for a clean map', () => {
    const r = resolveParams(
      {
        path: '{project.path}',
        line: '{project.name}/',
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.path).toBe('/Users/x/Code/space-tracker-v2');
      expect(r.values.line).toBe('space-tracker-v2/');
    }
  });

  it('resolveParams reports the first failing key', () => {
    const r = resolveParams(
      {
        path: '{project.path}',
        bad: '{not.a.thing}',
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.key).toBe('bad');
      expect(r.failure.token).toBe('not.a.thing');
    }
  });

  it('EXAMPLE_CONTEXT substitutes placeholder values (S149)', () => {
    const r = resolveTemplate('{project.path}/{project.name}', EXAMPLE_CONTEXT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('<example-path>/<example-name>');
  });
});

describe('Runner shell exports', () => {
  it('TRAILER_NAME and TRAILER_LABEL are stable strings', () => {
    expect(TRAILER_NAME).toBe('Register in setlist');
    expect(TRAILER_LABEL).toContain('Register in setlist');
    expect(TRAILER_LABEL).toContain('[final, automatic]');
  });

  it('newCleanupLog returns an empty log structure', () => {
    const log = newCleanupLog();
    expect(log.created_folders).toEqual([]);
    expect(log.inited_git_repos).toEqual([]);
    expect(log.gitignore_appends).toEqual([]);
    expect(log.external_side_effects).toEqual([]);
  });

  it('NULL_MCP_CALLER reports tools as not registered', async () => {
    const tools = await NULL_MCP_CALLER.listAvailableTools();
    expect(tools).toEqual([]);
    const call = await NULL_MCP_CALLER.callTool('mcp__foo__bar', {});
    expect(call.ok).toBe(false);
    if (!call.ok) {
      expect(call.not_registered).toBe(true);
      expect(call.error).toMatch(/not available/);
    }
  });
});
