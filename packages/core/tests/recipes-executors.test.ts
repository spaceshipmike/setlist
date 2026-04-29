// @fctry: #bootstrap-primitive-composition
//
// Tests for the three primitive shape executors plus the recipe walker.
// Spec 0.28: S142, S143, S144 foundation, S152, S153 idempotence.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import {
  walkRecipe,
  resumeWalk,
  preflight,
  filesystemExecutor,
  shellExecutor,
  mcpExecutor,
  firstBinary,
  binaryOnPath,
  newCleanupLog,
  type ExecutorContext,
  type ProjectContext,
  type McpToolCaller,
  PrimitivesRegistry,
} from '../src/index.js';
import Database from 'better-sqlite3';

let tmpDir: string;
let dbPath: string;
let projectPath: string;
let parentPath: string;
let registry: PrimitivesRegistry;
let projectCtx: ProjectContext;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'setlist-exec-'));
  dbPath = join(tmpDir, 'registry.db');
  parentPath = join(tmpDir, 'workspace');
  projectPath = join(parentPath, 'space-tracker-v2');
  mkdirSync(parentPath, { recursive: true });
  registry = new PrimitivesRegistry(dbPath);
  projectCtx = {
    name: 'space-tracker-v2',
    path: projectPath,
    type: 'Code project',
    parent_path: parentPath,
    template_directory: null,
  };
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Helpers
function getCodeRecipe() {
  const db = new Database(dbPath);
  const codeType = db
    .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
    .get() as { id: number };
  db.close();
  return registry.snapshotRecipe(codeType.id);
}

function getCodeTypeId() {
  const db = new Database(dbPath);
  const codeType = db
    .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
    .get() as { id: number };
  db.close();
  return codeType.id;
}

describe('firstBinary / binaryOnPath helpers', () => {
  it('extracts simple binary name', () => {
    expect(firstBinary('git init')).toBe('git');
  });

  it('strips leading cd path && chain', () => {
    expect(firstBinary('cd /tmp && git init')).toBe('git');
    expect(firstBinary('cd /a && cd /b && npm test')).toBe('npm');
  });

  it('strips leading env-var assignments', () => {
    expect(firstBinary('FOO=bar npm test')).toBe('npm');
    expect(firstBinary('FOO=bar BAZ=qux ls')).toBe('ls');
  });

  it('returns null for shell builtins', () => {
    expect(firstBinary('if true; then echo hi; fi')).toBeNull();
    expect(firstBinary('echo hi')).toBeNull();
    expect(firstBinary('cd /tmp')).toBeNull();
  });

  it('binaryOnPath finds /bin/sh (always present on macOS+linux)', () => {
    expect(binaryOnPath('sh')).toBe(true);
  });

  it('binaryOnPath returns false for definitely-missing binary', () => {
    expect(binaryOnPath('definitely-not-installed-9472')).toBe(false);
  });

  it('binaryOnPath checks absolute paths via existsSync', () => {
    expect(binaryOnPath('/bin/sh')).toBe(true);
    expect(binaryOnPath('/no/such/binary')).toBe(false);
  });
});

describe('filesystemExecutor — create-folder', () => {
  it('creates a folder', async () => {
    const cf = registry.getBuiltinByKey('create-folder')!;
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { path: projectPath },
      cleanup_log: newCleanupLog(),
    };
    const result = await filesystemExecutor.execute(cf, makeStep(cf, 0, { path: projectPath }), ctx);
    expect(result.status).toBe('succeeded');
    expect(existsSync(projectPath)).toBe(true);
    expect(ctx.cleanup_log!.created_folders).toEqual([projectPath]);
  });

  it('is idempotent on retry — mkdir-p semantic (S153)', async () => {
    const cf = registry.getBuiltinByKey('create-folder')!;
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { path: projectPath },
      cleanup_log: newCleanupLog(),
    };
    const result = await filesystemExecutor.execute(cf, makeStep(cf, 0, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(result.output).toContain('already existed');
    // Critical: pre-existing folder should NOT land in cleanup log (S147).
    expect(ctx.cleanup_log!.created_folders).toEqual([]);
  });

  it('preflight rejects empty path', async () => {
    const cf = registry.getBuiltinByKey('create-folder')!;
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { path: '' },
    };
    const result = await filesystemExecutor.preflight(cf, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('non-empty `path`');
  });
});

describe('filesystemExecutor — copy-template', () => {
  it('copies template directory contents', async () => {
    const ct = registry.getBuiltinByKey('copy-template')!;
    const templateDir = join(tmpDir, 'template');
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(join(templateDir, 'README.md'), '# {{name}}');
    mkdirSync(projectPath, { recursive: true });

    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { source: templateDir, destination: projectPath },
    };
    const result = await filesystemExecutor.execute(ct, makeStep(ct, 1, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(existsSync(join(projectPath, 'README.md'))).toBe(true);
  });

  it('is no-op when source is empty (S140 default-binding-when-template-null)', async () => {
    const ct = registry.getBuiltinByKey('copy-template')!;
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { source: '', destination: projectPath },
    };
    const result = await filesystemExecutor.execute(ct, makeStep(ct, 1, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(result.output).toContain('No template');
  });

  it('skips files that already exist on retry (S153)', async () => {
    const ct = registry.getBuiltinByKey('copy-template')!;
    const templateDir = join(tmpDir, 'template');
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(join(templateDir, 'README.md'), 'TEMPLATE_VERSION');
    mkdirSync(projectPath, { recursive: true });
    writeFileSync(join(projectPath, 'README.md'), 'USER_EDITS');

    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { source: templateDir, destination: projectPath },
    };
    await filesystemExecutor.execute(ct, makeStep(ct, 1, {}), ctx);
    // The user's edits must NOT be clobbered.
    expect(readFileSync(join(projectPath, 'README.md'), 'utf8')).toBe('USER_EDITS');
  });

  it('preflight rejects missing source path', async () => {
    const ct = registry.getBuiltinByKey('copy-template')!;
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { source: '/no/such/template', destination: projectPath },
    };
    const result = await filesystemExecutor.preflight(ct, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/does not exist/);
  });
});

describe('filesystemExecutor — append-to-file (update-parent-gitignore)', () => {
  it('appends a line when the file exists and the line is not present', async () => {
    const upg = registry.getBuiltinByKey('update-parent-gitignore')!;
    const gitignore = join(parentPath, '.gitignore');
    writeFileSync(gitignore, 'node_modules\n');
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { path: gitignore, line: `${projectCtx.name}/` },
      cleanup_log: newCleanupLog(),
    };
    const result = await filesystemExecutor.execute(upg, makeStep(upg, 3, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(readFileSync(gitignore, 'utf8')).toContain('space-tracker-v2/');
    // Cleanup log captures the original content (for Abandon revert — S147).
    expect(ctx.cleanup_log!.gitignore_appends.length).toBe(1);
    expect(ctx.cleanup_log!.gitignore_appends[0].original_content).toBe('node_modules\n');
  });

  it('is no-op when the line is already present (S153)', async () => {
    const upg = registry.getBuiltinByKey('update-parent-gitignore')!;
    const gitignore = join(parentPath, '.gitignore');
    writeFileSync(gitignore, 'node_modules\nspace-tracker-v2/\n');
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { path: gitignore, line: `${projectCtx.name}/` },
      cleanup_log: newCleanupLog(),
    };
    const result = await filesystemExecutor.execute(upg, makeStep(upg, 3, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(result.output).toContain('already present');
    expect(ctx.cleanup_log!.gitignore_appends.length).toBe(0);
  });

  it('is no-op when the file does not exist (best-effort, matches v0.27)', async () => {
    const upg = registry.getBuiltinByKey('update-parent-gitignore')!;
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { path: join(parentPath, '.gitignore'), line: 'foo/' },
    };
    const result = await filesystemExecutor.execute(upg, makeStep(upg, 3, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(result.output).toContain('does not exist');
  });
});

describe('shellExecutor', () => {
  it('runs git-init successfully and tracks the repo for Abandon (S147)', async () => {
    const gi = registry.getBuiltinByKey('git-init')!;
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
      cleanup_log: newCleanupLog(),
    };
    const result = await shellExecutor.execute(gi, makeStep(gi, 2, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(existsSync(join(projectPath, '.git'))).toBe(true);
    expect(ctx.cleanup_log!.inited_git_repos).toEqual([projectPath]);
  });

  it('preflight verifies binary on PATH', async () => {
    const gi = registry.getBuiltinByKey('git-init')!;
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
    };
    const result = await shellExecutor.preflight(gi, ctx);
    expect(result.ok).toBe(true); // git is on PATH in CI/dev
  });

  it('preflight rejects unresolved tokens in command', async () => {
    const custom = registry.createPrimitive({
      name: 'bad-cmd',
      description: '',
      definition: { shape: 'shell-command', command: '{not.real.token} arg' },
    });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: {},
    };
    const result = await shellExecutor.preflight(custom, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unresolved template token/);
  });

  it('captures stderr verbatim on failure (S144)', async () => {
    const custom = registry.createPrimitive({
      name: 'failing-cmd',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 7' },
    });
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
    };
    const result = await shellExecutor.execute(custom, makeStep(custom, 0, {}), ctx);
    expect(result.status).toBe('failed');
    expect(result.error_output).toBeDefined();
  });

  it('inherits user environment (S152)', async () => {
    const custom = registry.createPrimitive({
      name: 'echo-path',
      description: '',
      definition: { shape: 'shell-command', command: 'echo "$PATH"' },
    });
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
    };
    const result = await shellExecutor.execute(custom, makeStep(custom, 0, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(result.output).toBe(process.env.PATH);
  });

  // Spec 0.29: shell-command commands can reference recipe-step params
  // via {paramKey} placeholders, substituted before project-token resolve.
  it('substitutes recipe-step params in the command before project tokens resolve', async () => {
    const custom = registry.createPrimitive({
      name: 'echo-account',
      description: '',
      definition: { shape: 'shell-command', command: 'echo "{account}-{project.name}"' },
    });
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { account: 'm@h3r3.com', working_directory: projectPath },
    };
    const result = await shellExecutor.execute(custom, makeStep(custom, 0, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(result.output).toBe('m@h3r3.com-space-tracker-v2');
  });
});

// Spec 0.29 (S159, S163, S164): mail-create-mailbox built-in pre-flight.
// Note: end-to-end Mail.app integration cannot be tested in CI — these
// tests cover the structural behavior (probe, primitive shape).
describe('shellExecutor — mail-create-mailbox pre-flight (S159)', () => {
  it('pre-flight surfaces a Mail-not-running message OR passes (S159)', async () => {
    const mm = registry.getBuiltinByKey('mail-create-mailbox')!;
    const ctx: ExecutorContext = {
      project: { ...projectCtx, email_account: 'm@h3r3.com' },
      resolved_params: { account: 'm@h3r3.com', mailbox_path: 'Projects/space-tracker-v2', working_directory: projectPath },
    };
    const result = await shellExecutor.preflight(mm, ctx);
    // The probe is environment-dependent — Mail may or may not be running
    // on the build host. The contract: when ok=false, the reason names
    // Mail.app explicitly (S159 satisfaction criterion: actionable wording).
    if (!result.ok) {
      expect(result.reason).toMatch(/Mail\.app must be running/);
    }
  });

  it('the seeded primitive is shape=shell-command (closed-set invariant)', () => {
    const mm = registry.getBuiltinByKey('mail-create-mailbox')!;
    expect(mm.shape).toBe('shell-command');
  });
});

// Spec 0.29 (S162): structured external_side_effects envelope.
describe('shellExecutor — external_side_effects envelope shape (S162)', () => {
  it('shell-command non-builtin emits {step, primitive, summary} on success', async () => {
    const custom = registry.createPrimitive({
      name: 'pinger',
      description: '',
      definition: { shape: 'shell-command', command: 'echo ok' },
    });
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
      cleanup_log: newCleanupLog(),
    };
    const result = await shellExecutor.execute(custom, makeStep(custom, 3, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(ctx.cleanup_log!.external_side_effects).toHaveLength(1);
    const entry = ctx.cleanup_log!.external_side_effects[0];
    expect(entry).toMatchObject({
      step: 4, // 1-based
      primitive: 'pinger',
      summary: expect.stringContaining('echo ok'),
    });
  });

  it('git-init does NOT emit an external-side-effect entry (filesystem-undoable)', async () => {
    const gi = registry.getBuiltinByKey('git-init')!;
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
      cleanup_log: newCleanupLog(),
    };
    await shellExecutor.execute(gi, makeStep(gi, 2, {}), ctx);
    expect(ctx.cleanup_log!.external_side_effects).toHaveLength(0);
    expect(ctx.cleanup_log!.inited_git_repos).toEqual([projectPath]);
  });
});

// Spec 0.29 (S161): mid-recipe failure of mail-create-mailbox routes
// through the shared shell-command failure path. We can't actually
// invoke osascript with a typo'd account in CI, so simulate the failure
// shape with a stand-in command that mirrors AppleScript's exit-and-stderr
// pattern.
describe('shellExecutor — AppleScript-style failure routing (S161)', () => {
  it('captures osascript-shaped stderr verbatim into error_output', async () => {
    // Mirror the wording AppleScript would emit for an unknown account.
    const fakeOsascript = registry.createPrimitive({
      name: 'fake mail',
      description: '',
      definition: {
        shape: 'shell-command',
        command:
          `bash -c 'echo "execution error: Mail got an error: Can'"'"'t get account \\"typo@h3r3.com\\". (-1728)" >&2; exit 1'`,
      },
    });
    mkdirSync(projectPath, { recursive: true });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { working_directory: projectPath },
      cleanup_log: newCleanupLog(),
    };
    const result = await shellExecutor.execute(fakeOsascript, makeStep(fakeOsascript, 2, {}), ctx);
    expect(result.status).toBe('failed');
    expect(result.error_output).toBeDefined();
    expect(result.error_output).toContain("Can't get account");
    expect(result.error_output).toContain('typo@h3r3.com');
    // No external-side-effect entry because the step failed (S161 — only
    // succeeded steps record side effects for Abandon to surface).
    expect(ctx.cleanup_log!.external_side_effects).toHaveLength(0);
  });
});

describe('mcpExecutor', () => {
  it('preflight fails when no MCP caller is connected (S143)', async () => {
    const tool = registry.createPrimitive({
      name: 'todoist tool',
      description: '',
      definition: {
        shape: 'mcp-tool',
        toolName: 'mcp__asst-tools__todoist_create_task',
        defaults: { content: '{project.name}' },
      },
    });
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { content: projectCtx.name },
    };
    const result = await mcpExecutor.preflight(tool, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no host MCP client/);
  });

  it('preflight fails when the tool is not registered with the session (S143)', async () => {
    const tool = registry.createPrimitive({
      name: 'todoist tool',
      description: '',
      definition: {
        shape: 'mcp-tool',
        toolName: 'mcp__asst-tools__todoist_create_task',
        defaults: { content: '{project.name}' },
      },
    });
    const fakeCaller: McpToolCaller = {
      async listAvailableTools() {
        return [{ name: 'mcp__other__tool' }];
      },
      async callTool() {
        return { ok: false, error: 'not registered', not_registered: true };
      },
    };
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { content: projectCtx.name },
      mcp_caller: fakeCaller,
    };
    const result = await mcpExecutor.preflight(tool, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not currently registered/);
  });

  it('execute succeeds when the caller returns ok=true and tracks side-effect for Abandon (S147)', async () => {
    const tool = registry.createPrimitive({
      name: 'echo tool',
      description: '',
      definition: {
        shape: 'mcp-tool',
        toolName: 'mcp__test__echo',
        defaults: { msg: '{project.name}' },
      },
    });
    let capturedArgs: Record<string, unknown> | null = null;
    const okCaller: McpToolCaller = {
      async listAvailableTools() {
        return [{ name: 'mcp__test__echo' }];
      },
      async callTool(name, args) {
        capturedArgs = args;
        return { ok: true, result: { ok: 1 }, summary: `Echoed: ${args.msg}` };
      },
    };
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: { msg: projectCtx.name },
      mcp_caller: okCaller,
      cleanup_log: newCleanupLog(),
    };
    const result = await mcpExecutor.execute(tool, makeStep(tool, 0, {}), ctx);
    expect(result.status).toBe('succeeded');
    expect(capturedArgs?.msg).toBe('space-tracker-v2');
    // Spec 0.29 (S162): structured envelope { step, primitive, summary }.
    expect(ctx.cleanup_log!.external_side_effects.length).toBe(1);
    const entry = ctx.cleanup_log!.external_side_effects[0];
    expect(entry.primitive).toContain('echo tool');
    expect(typeof entry.step).toBe('number');
    expect(typeof entry.summary).toBe('string');
  });

  it('execute reports failure verbatim from the caller', async () => {
    const tool = registry.createPrimitive({
      name: 'failing tool',
      description: '',
      definition: { shape: 'mcp-tool', toolName: 'mcp__test__fail' },
    });
    const failCaller: McpToolCaller = {
      async listAvailableTools() {
        return [{ name: 'mcp__test__fail' }];
      },
      async callTool() {
        return { ok: false, error: 'Rate limited by API' };
      },
    };
    const ctx: ExecutorContext = {
      project: projectCtx,
      resolved_params: {},
      mcp_caller: failCaller,
    };
    const result = await mcpExecutor.execute(tool, makeStep(tool, 0, {}), ctx);
    expect(result.status).toBe('failed');
    expect(result.error_output).toBe('Rate limited by API');
  });
});

describe('walkRecipe — end-to-end integration (S142, S144)', () => {
  it('runs the seeded Code recipe in order with all built-in steps succeeded (S142)', async () => {
    const snapshot = getCodeRecipe();
    const env = await walkRecipe({
      snapshot,
      project: projectCtx,
    });
    expect(env.status).toBe('succeeded');
    expect(env.preflight.ok).toBe(true);
    // 4 user steps + 1 trailer = 5 entries
    expect(env.steps.length).toBe(5);
    // First 4 should be succeeded
    expect(env.steps.slice(0, 4).every((s) => s.status === 'succeeded')).toBe(true);
    // Trailer is left pending for the Bootstrap engine
    expect(env.steps[4].status).toBe('pending');
    expect(env.steps[4].shape).toBe('register-in-registry');
    // Side effects observable on disk
    expect(existsSync(projectPath)).toBe(true);
    expect(existsSync(join(projectPath, '.git'))).toBe(true);
  });

  it('halts on first failure and marks remaining steps not-run (S144)', async () => {
    // Insert a failing step between create-folder and git-init.
    const codeTypeId = getCodeTypeId();
    const cf = registry.getBuiltinByKey('create-folder')!;
    const failing = registry.createPrimitive({
      name: 'will fail',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 11' },
    });
    const gi = registry.getBuiltinByKey('git-init')!;
    registry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: projectPath } },
      { primitive_id: failing.id, params: { working_directory: projectPath } },
      { primitive_id: gi.id, params: { working_directory: projectPath } },
    ]);
    const snapshot = registry.snapshotRecipe(codeTypeId);
    const env = await walkRecipe({ snapshot, project: projectCtx });
    expect(env.status).toBe('failed');
    expect(env.failed_at).toBe(1);
    expect(env.steps[0].status).toBe('succeeded');
    expect(env.steps[1].status).toBe('failed');
    expect(env.steps[2].status).toBe('not-run');
    // git-init was never run — no .git directory
    expect(existsSync(join(projectPath, '.git'))).toBe(false);
    // Cleanup log captured the folder we created so Abandon can undo it
    expect(env.cleanup.created_folders).toEqual([projectPath]);
  });

  it('aborts before any side effect on pre-flight failure (S143)', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = registry.getBuiltinByKey('create-folder')!;
    const badShell = registry.createPrimitive({
      name: 'unknown binary',
      description: '',
      definition: { shape: 'shell-command', command: 'definitely-not-installed-9472' },
    });
    registry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: projectPath } },
      { primitive_id: badShell.id, params: {} },
    ]);
    const snapshot = registry.snapshotRecipe(codeTypeId);
    const env = await walkRecipe({ snapshot, project: projectCtx });
    expect(env.status).toBe('pre-flight-failed');
    // No side effects: folder NOT created
    expect(existsSync(projectPath)).toBe(false);
    expect(env.cleanup.created_folders).toEqual([]);
    expect(env.steps.every((s) => s.status === 'not-run')).toBe(true);
  });

  it('dry_run produces a trace with no side effects (S148 foundation)', async () => {
    const snapshot = getCodeRecipe();
    const env = await walkRecipe({
      snapshot,
      project: projectCtx,
      dry_run: true,
    });
    expect(env.status).toBe('succeeded');
    expect(env.steps.every((s) => s.status === 'not-run')).toBe(true);
    // No filesystem mutation
    expect(existsSync(projectPath)).toBe(false);
  });
});

describe('resumeWalk — Retry/Skip semantics (S145, S146, S153)', () => {
  it('Retry: previously-succeeded steps marked "(not re-run)" (S145, S153)', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = registry.getBuiltinByKey('create-folder')!;
    const failing = registry.createPrimitive({
      name: 'flaky',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 1' },
    });
    registry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: projectPath } },
      { primitive_id: failing.id, params: { working_directory: projectPath } },
    ]);
    const snapshot = registry.snapshotRecipe(codeTypeId);
    const first = await walkRecipe({ snapshot, project: projectCtx });
    expect(first.status).toBe('failed');
    expect(first.failed_at).toBe(1);

    // Now "fix" the issue by replacing the failing step with one that succeeds.
    // (In real life the user would fix the underlying cause; here we
    // demonstrate the resume mechanism honors the snapshot.)
    // For Retry-as-spec we re-run the same recipe — the failing step still
    // fails, but the previously-succeeded create-folder is NOT re-executed.
    const second = await resumeWalk({
      snapshot,
      project: projectCtx,
      succeeded_so_far: first.steps.filter((s) => s.status === 'succeeded'),
      resume_from: 1,
    });
    expect(second.status).toBe('failed');
    // The carried-forward succeeded step shows the "(not re-run)" tag.
    const carried = second.steps.find((s) => s.position === 0);
    expect(carried?.status).toBe('succeeded');
    expect(carried?.output).toContain('not re-run');
  });

  it('Skip: failed step marked skipped, walk continues (S146)', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = registry.getBuiltinByKey('create-folder')!;
    const failing = registry.createPrimitive({
      name: 'flaky',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 1' },
    });
    const gi = registry.getBuiltinByKey('git-init')!;
    registry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: projectPath } },
      { primitive_id: failing.id, params: { working_directory: projectPath } },
      { primitive_id: gi.id, params: { working_directory: projectPath } },
    ]);
    const snapshot = registry.snapshotRecipe(codeTypeId);
    const first = await walkRecipe({ snapshot, project: projectCtx });
    expect(first.status).toBe('failed');

    const second = await resumeWalk({
      snapshot,
      project: projectCtx,
      succeeded_so_far: first.steps.filter((s) => s.status === 'succeeded'),
      resume_from: 1,
      skip_failed: true,
    });
    expect(second.status).toBe('succeeded');
    const skipped = second.steps.find((s) => s.position === 1);
    expect(skipped?.status).toBe('skipped');
    // git-init then ran
    expect(existsSync(join(projectPath, '.git'))).toBe(true);
  });
});

describe('preflight — symbolic trace (S148, S149 foundation)', () => {
  it('returns one entry per recipe step plus the trailer', async () => {
    const snapshot = getCodeRecipe();
    const pre = await preflight({ snapshot, project: projectCtx });
    // 4 user steps + 1 trailer
    expect(pre.steps.length).toBe(5);
    expect(pre.steps[4].shape).toBe('register-in-registry');
  });

  it('reports unresolved template token as preflight ✗', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = registry.getBuiltinByKey('create-folder')!;
    registry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{projct.name}' } }, // typo
    ]);
    const snapshot = registry.snapshotRecipe(codeTypeId);
    const pre = await preflight({ snapshot, project: projectCtx });
    expect(pre.ok).toBe(false);
    const failing = pre.steps.find((s) => !s.ok);
    expect(failing?.reason).toContain('unresolved template token');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { Primitive, RecipeStep } from '../src/recipes/types.js';

function makeStep(p: Primitive, position: number, params: Record<string, string>): RecipeStep {
  return {
    id: 0,
    project_type_id: 0,
    position,
    primitive_id: p.id,
    primitive: p,
    params,
    created_at: 0,
    updated_at: 0,
  };
}
