// @fctry: #bootstrap-primitive-composition
//
// MCP integration tests for the spec 0.28 surface: list/get/create/update/
// delete primitives, get/replace/append recipe steps, dry-run bootstrap,
// and the bootstrap_resolve Retry/Skip/Abandon dispatcher.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from '../src/server.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import Database from 'better-sqlite3';

let tmpDir: string;
let dbPath: string;
let workspaceRoot: string;
let server: Server;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'setlist-mcp-rec-'));
  dbPath = join(tmpDir, 'registry.db');
  workspaceRoot = join(tmpDir, 'Code');
  mkdirSync(workspaceRoot, { recursive: true });
  server = createServer(dbPath, { skipSelfRegister: true });

  // Reroute Code project type's default_directory to our sandbox
  const db = new Database(dbPath);
  db.prepare(`UPDATE project_types SET default_directory = ? WHERE name = ?`).run(
    workspaceRoot,
    'Code project',
  );
  db.close();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  // The server uses request handlers; invoke them like the SDK does
  const handler = (
    server as unknown as {
      _requestHandlers: Map<string, (request: unknown) => Promise<{ content: { text: string }[] }>>;
    }
  )._requestHandlers.get(CallToolRequestSchema.shape.method.value);
  if (!handler) throw new Error('No CallTool handler registered');
  const response = await handler({
    method: CallToolRequestSchema.shape.method.value,
    params: { name, arguments: args },
  });
  const text = response.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getCodeTypeId(): number {
  const db = new Database(dbPath);
  const row = db
    .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
    .get() as { id: number };
  db.close();
  return row.id;
}

describe('list_primitives / get_primitive', () => {
  it('list_primitives returns the four built-ins', async () => {
    const result = (await callTool('list_primitives')) as { is_builtin: boolean }[];
    expect(Array.isArray(result)).toBe(true);
    expect(result.filter((p) => p.is_builtin).length).toBe(4);
  });

  it('get_primitive returns one row by id', async () => {
    const all = (await callTool('list_primitives')) as { id: number; name: string }[];
    const cf = all.find((p) => p.name === 'Create folder')!;
    const fetched = (await callTool('get_primitive', { id: cf.id })) as { name: string };
    expect(fetched.name).toBe('Create folder');
  });
});

describe('create_primitive / update_primitive / delete_primitive', () => {
  it('creates an mcp-tool primitive (S139)', async () => {
    const created = (await callTool('create_primitive', {
      name: 'Create Todoist project',
      description: 'Creates a Todoist project named after the new setlist project',
      definition: {
        shape: 'mcp-tool',
        toolName: 'mcp__asst-tools__todoist_create_task',
        defaults: { content: '{project.name}' },
      },
    })) as { id: number; is_builtin: boolean; shape: string };
    expect(created.id).toBeGreaterThan(0);
    expect(created.is_builtin).toBe(false);
    expect(created.shape).toBe('mcp-tool');
  });

  it('rejects update on built-in primitive (S140)', async () => {
    const all = (await callTool('list_primitives')) as { id: number; is_builtin: boolean }[];
    const builtin = all.find((p) => p.is_builtin)!;
    const result = await callTool('update_primitive', { id: builtin.id, name: 'renamed' });
    // Errors come back as plain strings in the test harness
    expect(typeof result === 'string' && result.includes('cannot be edited')).toBe(true);
  });

  it('rejects delete on built-in primitive (S140)', async () => {
    const all = (await callTool('list_primitives')) as { id: number; is_builtin: boolean }[];
    const builtin = all.find((p) => p.is_builtin)!;
    const result = await callTool('delete_primitive', { id: builtin.id });
    expect(typeof result === 'string' && result.includes('cannot be deleted')).toBe(true);
  });

  it('full CRUD on a custom primitive', async () => {
    const created = (await callTool('create_primitive', {
      name: 'shell-step',
      description: 'echoes',
      definition: { shape: 'shell-command', command: 'echo hi' },
    })) as { id: number };
    const updated = (await callTool('update_primitive', { id: created.id, description: 'updated' })) as { description: string };
    expect(updated.description).toBe('updated');
    const del = (await callTool('delete_primitive', { id: created.id })) as { ok: boolean };
    expect(del.ok).toBe(true);
    const after = (await callTool('get_primitive', { id: created.id })) as null;
    expect(after).toBeNull();
  });
});

describe('get_recipe / replace_recipe / append_recipe_step (S141)', () => {
  it('get_recipe returns the seeded Code recipe', async () => {
    const recipe = (await callTool('get_recipe', { project_type_id: getCodeTypeId() })) as {
      steps: { primitive: { builtin_key: string } }[];
    };
    const keys = recipe.steps.map((s) => s.primitive.builtin_key);
    expect(keys).toEqual(['create-folder', 'copy-template', 'git-init', 'update-parent-gitignore']);
  });

  it('replace_recipe atomically swaps the recipe', async () => {
    const all = (await callTool('list_primitives')) as { id: number; builtin_key: string | null }[];
    const cf = all.find((p) => p.builtin_key === 'create-folder')!;
    const gi = all.find((p) => p.builtin_key === 'git-init')!;
    const result = (await callTool('replace_recipe', {
      project_type_id: getCodeTypeId(),
      steps: [
        { primitive_id: gi.id, params: { working_directory: '{project.path}' } },
        { primitive_id: cf.id, params: { path: '{project.path}' } },
      ],
    })) as { steps: { primitive: { builtin_key: string } }[] };
    expect(result.steps.length).toBe(2);
    expect(result.steps[0].primitive.builtin_key).toBe('git-init');
    expect(result.steps[1].primitive.builtin_key).toBe('create-folder');
  });

  it('append_recipe_step adds at the end', async () => {
    const created = (await callTool('create_primitive', {
      name: 'extra',
      description: '',
      definition: { shape: 'shell-command', command: 'true' },
    })) as { id: number };
    const before = (await callTool('get_recipe', { project_type_id: getCodeTypeId() })) as { steps: unknown[] };
    await callTool('append_recipe_step', {
      project_type_id: getCodeTypeId(),
      primitive_id: created.id,
      params: {},
    });
    const after = (await callTool('get_recipe', { project_type_id: getCodeTypeId() })) as { steps: unknown[] };
    expect(after.steps.length).toBe(before.steps.length + 1);
  });

  it('empty recipes are valid (S141)', async () => {
    const empty = (await callTool('replace_recipe', {
      project_type_id: getCodeTypeId(),
      steps: [],
    })) as { steps: unknown[] };
    expect(empty.steps).toEqual([]);
  });
});

describe('bootstrap_project — dry_run (S148)', () => {
  it('returns a per-step trace with no side effects', async () => {
    const result = (await callTool('bootstrap_project', {
      name: 'dry-run-mcp',
      project_type_id: getCodeTypeId(),
      dry_run: true,
    })) as {
      kind: string;
      steps: { primitive_name: string; resolved_params: Record<string, string>; preflight_ok: boolean }[];
    };
    expect(result.kind).toBe('dry-run');
    expect(result.steps.length).toBe(5); // 4 + trailer
    expect(result.steps[4].primitive_name).toContain('Register in setlist');
    // No filesystem mutation
    expect(existsSync(join(workspaceRoot, 'dry-run-mcp'))).toBe(false);
  });
});

describe('bootstrap_project + bootstrap_resolve (S144, S145, S146, S147)', () => {
  it('returns kind=pending with a token on mid-run failure (S144)', async () => {
    const all = (await callTool('list_primitives')) as { id: number; builtin_key: string | null }[];
    const cf = all.find((p) => p.builtin_key === 'create-folder')!;
    const failing = (await callTool('create_primitive', {
      name: 'fail-step',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 5' },
    })) as { id: number };
    await callTool('replace_recipe', {
      project_type_id: getCodeTypeId(),
      steps: [
        { primitive_id: cf.id, params: { path: '{project.path}' } },
        { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
      ],
    });

    const result = (await callTool('bootstrap_project', {
      name: 'pending-target',
      project_type_id: getCodeTypeId(),
    })) as {
      kind: string;
      token: string;
      failed_at: number;
      actions: string[];
    };
    expect(result.kind).toBe('pending');
    expect(result.token).toMatch(/^bootstrap-/);
    expect(result.failed_at).toBe(1);
    expect(result.actions).toEqual(['retry', 'skip', 'abandon']);

    // Now skip and continue (S146)
    const skipResult = (await callTool('bootstrap_resolve', {
      token: result.token,
      action: 'skip',
    })) as { kind: string; name: string };
    expect(skipResult.kind).toBe('success');
    expect(skipResult.name).toBe('pending-target');
  });

  it('abandon undoes filesystem work (S147)', async () => {
    const all = (await callTool('list_primitives')) as { id: number; builtin_key: string | null }[];
    const cf = all.find((p) => p.builtin_key === 'create-folder')!;
    const failing = (await callTool('create_primitive', {
      name: 'fail-step-2',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 5' },
    })) as { id: number };
    await callTool('replace_recipe', {
      project_type_id: getCodeTypeId(),
      steps: [
        { primitive_id: cf.id, params: { path: '{project.path}' } },
        { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
      ],
    });

    const result = (await callTool('bootstrap_project', {
      name: 'abandon-mcp',
      project_type_id: getCodeTypeId(),
    })) as { kind: string; token: string };
    expect(result.kind).toBe('pending');
    const targetPath = join(workspaceRoot, 'abandon-mcp');
    expect(existsSync(targetPath)).toBe(true);

    const abandoned = (await callTool('bootstrap_resolve', {
      token: result.token,
      action: 'abandon',
    })) as { kind: string; cleaned_up: string[] };
    expect(abandoned.kind).toBe('abandoned');
    expect(existsSync(targetPath)).toBe(false);
    expect(abandoned.cleaned_up.some((s) => s.includes(targetPath))).toBe(true);
  });

  it('rejects unknown token', async () => {
    const result = await callTool('bootstrap_resolve', {
      token: 'no-such-token',
      action: 'retry',
    });
    expect(typeof result === 'string' && result.includes('No pending bootstrap')).toBe(true);
  });
});
