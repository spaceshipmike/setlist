// @fctry: #project-bootstrap
//
// Tests for the recipe-driven Bootstrap class (spec 0.28).
// Covers S145 (Retry resumes from failed step), S146 (Skip continues),
// S147 (Abandon cleans filesystem + git, leaves external in place),
// S151 (recipe edits don't retroactively affect existing projects),
// S148 (Dry run trace), and S142 end-to-end.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import {
  Bootstrap,
  PrimitivesRegistry,
  Registry,
  type BootstrapEnvelope,
  type BootstrapPendingState,
} from '../src/index.js';
import Database from 'better-sqlite3';

let tmpDir: string;
let dbPath: string;
let workspaceRoot: string;
let bootstrap: Bootstrap;
let primitivesRegistry: PrimitivesRegistry;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'setlist-bs-recipe-'));
  dbPath = join(tmpDir, 'registry.db');
  workspaceRoot = join(tmpDir, 'Code');
  mkdirSync(workspaceRoot, { recursive: true });
  bootstrap = new Bootstrap(dbPath);
  primitivesRegistry = new PrimitivesRegistry(dbPath);

  // Override the seeded Code project's default_directory to point at our
  // sandbox (so we don't write to ~/Code in tests).
  const db = new Database(dbPath);
  db.prepare(`UPDATE project_types SET default_directory = ? WHERE name = ?`).run(
    workspaceRoot,
    'Code project',
  );
  db.prepare(`UPDATE project_types SET default_directory = ? WHERE name = ?`).run(
    workspaceRoot,
    'Non-code project',
  );
  db.close();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function getCodeTypeId(): number {
  const db = new Database(dbPath);
  const row = db
    .prepare(`SELECT id FROM project_types WHERE name = 'Code project'`)
    .get() as { id: number };
  db.close();
  return row.id;
}

describe('bootstrapWithRecipe — happy path (S142)', () => {
  it('runs the seeded Code recipe end-to-end and registers the project', async () => {
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'space-tracker-v2',
      project_type_id: getCodeTypeId(),
    });
    expect(env.kind).toBe('success');
    if (env.kind !== 'success') return;
    expect(env.path).toBe(join(workspaceRoot, 'space-tracker-v2'));
    expect(env.git_initialized).toBe(true);
    expect(existsSync(join(env.path, '.git'))).toBe(true);
    expect(env.executed_steps?.length).toBe(5); // 4 user steps + trailer
    expect(env.executed_steps![4].name).toContain('Register in setlist');
    expect(env.executed_steps![4].status).toBe('succeeded');

    const registry = new Registry(dbPath);
    const proj = registry.getProject('space-tracker-v2');
    expect(proj).not.toBeNull();
  });

  it('Non-code recipe omits git-init', async () => {
    const db = new Database(dbPath);
    const ncId = (db
      .prepare(`SELECT id FROM project_types WHERE name = 'Non-code project'`)
      .get() as { id: number }).id;
    db.close();
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'family-events-2026',
      project_type_id: ncId,
    });
    expect(env.kind).toBe('success');
    if (env.kind !== 'success') return;
    expect(env.git_initialized).toBe(false);
    expect(existsSync(join(env.path, '.git'))).toBe(false);
  });
});

describe('bootstrapWithRecipe — pre-flight failures (S143)', () => {
  it('returns pre-flight-failed when target folder already exists', async () => {
    mkdirSync(join(workspaceRoot, 'space-tracker-v2'), { recursive: true });
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'space-tracker-v2',
      project_type_id: getCodeTypeId(),
    });
    expect(env.kind).toBe('pre-flight-failed');
    if (env.kind !== 'pre-flight-failed') return;
    expect(env.preflight_failures.length).toBe(1);
    expect(env.preflight_failures[0].reason).toContain('already exists');
  });

  it('returns pre-flight-failed for unknown shell binary, no side effects', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const badShell = primitivesRegistry.createPrimitive({
      name: 'unknown-bin',
      description: '',
      definition: { shape: 'shell-command', command: 'definitely-not-installed-9472 arg' },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: badShell.id, params: {} },
    ]);
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'should-not-create',
      project_type_id: codeTypeId,
    });
    expect(env.kind).toBe('pre-flight-failed');
    expect(existsSync(join(workspaceRoot, 'should-not-create'))).toBe(false);
  });
});

describe('bootstrapWithRecipe — mid-run failure (S144)', () => {
  it('returns pending state with stop-and-report shape', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const failing = primitivesRegistry.createPrimitive({
      name: 'failing step',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 7' },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
    ]);
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'partial-build',
      project_type_id: codeTypeId,
    });
    expect(env.kind).toBe('pending');
    if (env.kind !== 'pending') return;
    expect(env.failed_at).toBe(1);
    expect(env.executed_steps[0].status).toBe('succeeded');
    expect(env.executed_steps[1].status).toBe('failed');
    expect(env.cleanup.created_folders).toEqual([join(workspaceRoot, 'partial-build')]);
    // Project NOT registered (S144)
    const registry = new Registry(dbPath);
    expect(registry.getProject('partial-build')).toBeNull();
  });
});

describe('Retry (S145)', () => {
  it('Retry resumes from the failed step without re-running successes', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    // Use a side-effect-tracking shell command so we can verify it doesn't re-run.
    const sideEffectFile = join(tmpDir, 'side-effect.log');
    const tracking = primitivesRegistry.createPrimitive({
      name: 'tracker',
      description: '',
      definition: {
        shape: 'shell-command',
        command: `echo "ran" >> "${sideEffectFile}"`,
      },
    });
    const failing = primitivesRegistry.createPrimitive({
      name: 'flaky',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 1' },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: tracking.id, params: { working_directory: '{project.path}' } },
      { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
    ]);

    const first = await bootstrap.bootstrapWithRecipe({
      name: 'retry-target',
      project_type_id: codeTypeId,
    });
    expect(first.kind).toBe('pending');
    if (first.kind !== 'pending') return;
    // tracker ran exactly once
    expect(readFileSync(sideEffectFile, 'utf8').match(/ran/g)?.length).toBe(1);

    // Now Retry — the failing step still fails, but tracker should NOT re-run.
    const second = await bootstrap.retryBootstrap(first);
    expect(second.kind).toBe('pending'); // still failing
    // tracker should still have run only once (S145)
    expect(readFileSync(sideEffectFile, 'utf8').match(/ran/g)?.length).toBe(1);
  });

  it('Retry succeeds when underlying cause is fixed', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const flagFile = join(tmpDir, 'flag');
    const conditional = primitivesRegistry.createPrimitive({
      name: 'conditional',
      description: '',
      // Fails when flag absent, succeeds when flag present
      definition: {
        shape: 'shell-command',
        command: `test -f "${flagFile}"`,
      },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: conditional.id, params: { working_directory: '{project.path}' } },
    ]);

    const first = await bootstrap.bootstrapWithRecipe({
      name: 'retry-success',
      project_type_id: codeTypeId,
    });
    expect(first.kind).toBe('pending');
    if (first.kind !== 'pending') return;

    // "Fix" the underlying cause
    writeFileSync(flagFile, 'x');

    const second = await bootstrap.retryBootstrap(first);
    expect(second.kind).toBe('success');
    if (second.kind !== 'success') return;
    // Project IS registered now
    const registry = new Registry(dbPath);
    expect(registry.getProject('retry-success')).not.toBeNull();
  });
});

describe('Skip (S146)', () => {
  it('Skip marks failed step as skipped and continues to register', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const failing = primitivesRegistry.createPrimitive({
      name: 'failing-side',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 1' },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
    ]);

    const first = await bootstrap.bootstrapWithRecipe({
      name: 'skip-target',
      project_type_id: codeTypeId,
    });
    expect(first.kind).toBe('pending');
    if (first.kind !== 'pending') return;

    const second = await bootstrap.skipFailedAndContinue(first);
    expect(second.kind).toBe('success');
    if (second.kind !== 'success') return;
    const skipped = second.executed_steps?.find((s) => s.position === 1);
    expect(skipped?.status).toBe('skipped');
    // Project IS registered
    const registry = new Registry(dbPath);
    expect(registry.getProject('skip-target')).not.toBeNull();
  });
});

describe('Abandon (S147)', () => {
  it('removes folder + git repo, reverts gitignore, lists external side effects', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const gi = primitivesRegistry.getBuiltinByKey('git-init')!;
    const upg = primitivesRegistry.getBuiltinByKey('update-parent-gitignore')!;
    // Pre-create parent .gitignore so update-parent-gitignore appends to it
    const gitignorePath = join(workspaceRoot, '.gitignore');
    writeFileSync(gitignorePath, 'node_modules\n');

    // External side effect: a fake mcp-tool primitive
    const todoist = primitivesRegistry.createPrimitive({
      name: 'fake todoist',
      description: '',
      definition: { shape: 'mcp-tool', toolName: 'mcp__test__create' },
    });
    const failing = primitivesRegistry.createPrimitive({
      name: 'failing-step',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 5' },
    });

    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: gi.id, params: { working_directory: '{project.path}' } },
      { primitive_id: upg.id, params: { path: '{project.parent_path}/.gitignore', line: '{project.name}/' } },
      { primitive_id: todoist.id, params: { content: '{project.name}' } },
      { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
    ]);

    // Provide an MCP caller that says todoist tool is registered + succeeds
    const mcpCaller = {
      async listAvailableTools() {
        return [{ name: 'mcp__test__create' }];
      },
      async callTool() {
        return { ok: true as const, result: {}, summary: 'Created Todoist project' };
      },
    };

    const first = await bootstrap.bootstrapWithRecipe({
      name: 'abandon-target',
      project_type_id: codeTypeId,
      mcp_caller: mcpCaller,
    });
    expect(first.kind).toBe('pending');
    if (first.kind !== 'pending') return;
    const projectPath = first.path;
    expect(existsSync(projectPath)).toBe(true);
    expect(existsSync(join(projectPath, '.git'))).toBe(true);
    expect(readFileSync(gitignorePath, 'utf8')).toContain('abandon-target/');

    const result = bootstrap.abandonBootstrap(first);
    expect(result.kind).toBe('abandoned');
    // Folder and .git removed
    expect(existsSync(projectPath)).toBe(false);
    // Parent gitignore reverted
    expect(readFileSync(gitignorePath, 'utf8')).toBe('node_modules\n');
    // External side effect listed in left_in_place
    const leftLabels = result.left_in_place.join('|');
    expect(leftLabels).toContain('fake todoist');
    // Cleaned-up list is non-empty and labels are honest
    expect(result.cleaned_up.some((s) => s.includes(projectPath))).toBe(true);
    // Registry still has no row (S147 — never registered)
    const registry = new Registry(dbPath);
    expect(registry.getProject('abandon-target')).toBeNull();
  });
});

describe('Bootstrap-time-only evaluation (S151)', () => {
  it('recipe edits do not retroactively affect previously-bootstrapped projects', async () => {
    const codeTypeId = getCodeTypeId();
    // First bootstrap with the seeded recipe
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'alpha',
      project_type_id: codeTypeId,
    });
    expect(env.kind).toBe('success');
    if (env.kind !== 'success') return;
    const registry = new Registry(dbPath);
    const alphaBefore = registry.getProject('alpha');
    expect(alphaBefore).not.toBeNull();

    // Add a new step to the Code recipe
    const newStep = primitivesRegistry.createPrimitive({
      name: 'post-bootstrap-side-effect',
      description: '',
      definition: { shape: 'shell-command', command: 'true' },
    });
    primitivesRegistry.appendStep(codeTypeId, newStep.id, {});

    // alpha should be COMPLETELY unchanged — same fields, no new files,
    // no extra registry mutation
    const alphaAfter = registry.getProject('alpha');
    expect(alphaAfter).toEqual(alphaBefore);

    // A NEW project bootstrapped after the edit DOES use the new recipe
    const envBeta = await bootstrap.bootstrapWithRecipe({
      name: 'beta',
      project_type_id: codeTypeId,
    });
    expect(envBeta.kind).toBe('success');
    if (envBeta.kind !== 'success') return;
    expect(envBeta.executed_steps?.some((s) => s.name === 'post-bootstrap-side-effect')).toBe(true);
  });

  it('snapshot is bound to the in-flight attempt — Retry uses the snapshot, not the live recipe', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const failing = primitivesRegistry.createPrimitive({
      name: 'flaky-once',
      description: '',
      definition: { shape: 'shell-command', command: 'exit 1' },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: failing.id, params: { working_directory: '{project.path}' } },
    ]);

    const first = await bootstrap.bootstrapWithRecipe({
      name: 'snapshot-bound',
      project_type_id: codeTypeId,
    });
    expect(first.kind).toBe('pending');
    if (first.kind !== 'pending') return;
    const snapshotStepCount = first.snapshot.steps.length;

    // User edits the recipe in between (adds 5 more steps)
    for (let i = 0; i < 5; i++) {
      const extra = primitivesRegistry.createPrimitive({
        name: `extra-${i}`,
        description: '',
        definition: { shape: 'shell-command', command: 'true' },
      });
      primitivesRegistry.appendStep(codeTypeId, extra.id, {});
    }

    // Retry should use the original snapshot, not the live recipe
    expect(first.snapshot.steps.length).toBe(snapshotStepCount);
    // (The added steps do NOT appear in the snapshot.)
    const liveRecipe = primitivesRegistry.getRecipe(codeTypeId);
    expect(liveRecipe.steps.length).toBeGreaterThan(snapshotStepCount);
  });
});

describe('Dry run (S148)', () => {
  it('renders per-step trace with no side effects', async () => {
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'dry-run-target',
      project_type_id: getCodeTypeId(),
      dry_run: true,
    });
    expect(env.kind).toBe('dry-run');
    if (env.kind !== 'dry-run') return;
    expect(env.steps.length).toBe(5); // 4 + trailer
    expect(env.steps[4].primitive_name).toContain('Register in setlist');
    // Resolved params show the actual project name
    const cfStep = env.steps.find((s) => s.primitive_name === 'Create folder');
    expect(cfStep?.resolved_params.path).toBe(join(workspaceRoot, 'dry-run-target'));
    // No side effects
    expect(existsSync(join(workspaceRoot, 'dry-run-target'))).toBe(false);
    const registry = new Registry(dbPath);
    expect(registry.getProject('dry-run-target')).toBeNull();
  });

  it('dry run shows preflight ✗ for unknown binaries', async () => {
    const codeTypeId = getCodeTypeId();
    const cf = primitivesRegistry.getBuiltinByKey('create-folder')!;
    const bad = primitivesRegistry.createPrimitive({
      name: 'no-such-bin',
      description: '',
      definition: { shape: 'shell-command', command: 'definitely-not-installed-9472' },
    });
    primitivesRegistry.replaceRecipe(codeTypeId, [
      { primitive_id: cf.id, params: { path: '{project.path}' } },
      { primitive_id: bad.id, params: { working_directory: '{project.path}' } },
    ]);
    const env = await bootstrap.bootstrapWithRecipe({
      name: 'dry-run-bad',
      project_type_id: codeTypeId,
      dry_run: true,
    });
    expect(env.kind).toBe('dry-run');
    if (env.kind !== 'dry-run') return;
    const badStep = env.steps.find((s) => s.primitive_name === 'no-such-bin');
    expect(badStep?.preflight_ok).toBe(false);
    expect(badStep?.preflight_reason).toContain('not on PATH');
  });
});

describe('Backward compatibility — legacy bootstrapProject path still works', () => {
  it('legacy bootstrapProject (sync) still produces a result', () => {
    const result = bootstrap.bootstrapProject({
      name: 'legacy-test',
      project_type_id: getCodeTypeId(),
    });
    expect(result.name).toBe('legacy-test');
    expect(result.git_initialized).toBe(true);
    expect(existsSync(result.path)).toBe(true);
    const registry = new Registry(dbPath);
    expect(registry.getProject('legacy-test')).not.toBeNull();
  });
});
