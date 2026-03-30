import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry } from '../src/index.js';

describe('Registry', () => {
  let tmpDir: string;
  let registry: Registry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-test-'));
    registry = new Registry(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── S03: Project Registration ──────────────────────────────

  describe('register (S03)', () => {
    it('registers a project and makes it queryable', () => {
      registry.register({
        name: 'my-project',
        type: 'project',
        status: 'active',
        description: 'A test project',
        goals: 'Test goals',
        display_name: 'My Project',
        paths: ['/Users/test/Code/my-project'],
      });

      const project = registry.getProject('my-project', 'full');
      expect(project).not.toBeNull();
      expect(project!.name).toBe('my-project');
      expect(project!.display_name).toBe('My Project');
      expect(project!.type).toBe('project');
      expect(project!.status).toBe('active');
      expect(project!.description).toBe('A test project');
      expect(project!.goals).toBe('Test goals');
      expect(project!.paths).toEqual(['/Users/test/Code/my-project']);
    });

    it('defaults display_name to name', () => {
      registry.register({ name: 'test-proj', type: 'project', status: 'active' });
      const p = registry.getProject('test-proj', 'summary');
      expect(p!.display_name).toBe('test-proj');
    });

    it('rejects duplicate names', () => {
      registry.register({ name: 'dup', type: 'project', status: 'active' });
      expect(() => registry.register({ name: 'dup', type: 'project', status: 'active' }))
        .toThrow('DUPLICATE');
    });

    it('validates status against type', () => {
      expect(() => registry.register({ name: 'bad', type: 'area_of_focus', status: 'archived' }))
        .toThrow('Invalid status');
    });

    it('registers area_of_focus', () => {
      registry.register({ name: 'health', type: 'area_of_focus', status: 'active', description: 'Health tracking' });
      const p = registry.getProject('health');
      expect(p!.type).toBe('area_of_focus');
    });
  });

  // ── S04: Progressive Disclosure ────────────────────────────

  describe('progressive disclosure (S04)', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        registry.register({
          name: `proj-${i}`,
          type: 'project',
          status: i < 3 ? 'active' : 'paused',
          description: `Project ${i}`,
          goals: `Goal ${i}`,
          paths: [`/path/${i}`],
        });
        registry.updateFields(`proj-${i}`, { tech_stack: ['typescript', 'sqlite'] }, 'fctry');
      }
      registry.register({ name: 'aof-1', type: 'area_of_focus', status: 'active', description: 'Area' });
    });

    it('summary depth returns only core identity', () => {
      const projects = registry.listProjects({ depth: 'summary' });
      expect(projects.length).toBe(6);
      const p = projects.find(p => p.name === 'proj-0')!;
      expect(p.name).toBeDefined();
      expect(p.display_name).toBeDefined();
      expect(p.type).toBeDefined();
      expect(p.status).toBeDefined();
      expect(p.description).toBeDefined();
      // Should NOT have extended fields or paths at summary
      expect(p.goals).toBeUndefined();
      expect(p.fields).toBeUndefined();
      expect(p.paths).toBeUndefined();
    });

    it('standard depth adds goals, paths, template fields', () => {
      const p = registry.getProject('proj-0', 'standard')!;
      expect(p.goals).toBe('Goal 0');
      expect(p.paths).toEqual(['/path/0']);
      expect(p.fields).toBeDefined();
    });

    it('full depth includes everything', () => {
      const p = registry.getProject('proj-0', 'full')!;
      expect(p.created_at).toBeDefined();
      expect(p.updated_at).toBeDefined();
    });

    it('type_filter excludes areas of focus', () => {
      const projects = registry.listProjects({ type_filter: 'project' });
      expect(projects.every(p => p.type === 'project')).toBe(true);
      expect(projects.length).toBe(5);
    });

    it('status_filter works', () => {
      const active = registry.listProjects({ status_filter: 'active' });
      expect(active.every(p => p.status === 'active')).toBe(true);
    });

    it('filters compose', () => {
      const result = registry.listProjects({ type_filter: 'project', status_filter: 'paused' });
      expect(result.length).toBe(2);
      expect(result.every(p => p.type === 'project' && p.status === 'paused')).toBe(true);
    });
  });

  // ── S06: Fuzzy Match ───────────────────────────────────────

  describe('fuzzy match (S06)', () => {
    beforeEach(() => {
      registry.register({ name: 'project-registry-service', type: 'project', status: 'active' });
    });

    it('suggests close match on NOT_FOUND', () => {
      expect(() => registry.getProjectOrThrow('project-registy'))
        .toThrow(/did you mean.*project-registry-service/i);
    });

    it('exact match works without suggestion', () => {
      const p = registry.getProjectOrThrow('project-registry-service');
      expect(p.name).toBe('project-registry-service');
    });
  });

  // ── S26: Update and Administration ─────────────────────────

  describe('updateCore (S26)', () => {
    beforeEach(() => {
      registry.register({ name: 'updatable', type: 'project', status: 'active', description: 'Original' });
    });

    it('updates display_name', () => {
      registry.updateCore('updatable', { display_name: 'New Name' });
      const p = registry.getProject('updatable', 'summary')!;
      expect(p.display_name).toBe('New Name');
    });

    it('preserves unspecified fields', () => {
      registry.updateCore('updatable', { display_name: 'Changed' });
      const p = registry.getProject('updatable', 'full')!;
      expect(p.description).toBe('Original');
      expect(p.status).toBe('active');
    });

    it('validates status on update', () => {
      expect(() => registry.updateCore('updatable', { status: 'invalid' }))
        .toThrow('Invalid status');
    });

    it('throws NOT_FOUND for missing project', () => {
      expect(() => registry.updateCore('nonexistent', { status: 'paused' }))
        .toThrow('NOT_FOUND');
    });
  });

  // ── S27: Context Switching ─────────────────────────────────

  describe('switchProject (S27)', () => {
    it('returns full context including ports', () => {
      registry.register({
        name: 'ctx-project',
        type: 'project',
        status: 'active',
        description: 'Context test',
        paths: ['/path/a', '/path/b'],
      });
      registry.claimPort('ctx-project', 'dev server', 3000);

      const ctx = registry.switchProject('ctx-project');
      expect(ctx.paths).toEqual(['/path/a', '/path/b']);
      expect(ctx.status).toBe('active');
      expect(ctx.description).toBe('Context test');
      expect(ctx.ports).toHaveLength(1);
      expect((ctx.ports as { port: number }[])[0].port).toBe(3000);
    });
  });

  // ── S28: Search ────────────────────────────────────────────

  describe('searchProjects (S28)', () => {
    beforeEach(() => {
      registry.register({ name: 'auth-service', type: 'project', status: 'active', description: 'Authentication service' });
      registry.register({ name: 'data-pipeline', type: 'project', status: 'active', description: 'Data processing' });
      registry.register({ name: 'paused-auth', type: 'project', status: 'paused', description: 'Old auth system' });
    });

    it('searches across name and description', () => {
      const results = registry.searchProjects({ query: 'auth' });
      expect(results.length).toBe(2);
    });

    it('filters compose with search', () => {
      const results = registry.searchProjects({ query: 'auth', status_filter: 'active' });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('auth-service');
    });

    it('returns empty array on no match', () => {
      const results = registry.searchProjects({ query: 'zzz_nonexistent' });
      expect(results).toEqual([]);
    });
  });

  // ── S30: Registry Stats ────────────────────────────────────

  describe('getRegistryStats (S30)', () => {
    it('returns correct counts', () => {
      registry.register({ name: 'p1', type: 'project', status: 'active' });
      registry.register({ name: 'p2', type: 'project', status: 'paused' });
      registry.register({ name: 'a1', type: 'area_of_focus', status: 'active' });

      const stats = registry.getRegistryStats();
      expect(stats.total).toBe(3);
      expect(stats.by_type.project).toBe(2);
      expect(stats.by_type.area_of_focus).toBe(1);
      expect(stats.by_status.active).toBe(2);
      expect(stats.by_status.paused).toBe(1);
    });
  });

  // ── S05: Field Enrichment ──────────────────────────────────

  describe('updateFields / producer isolation (S05)', () => {
    beforeEach(() => {
      registry.register({ name: 'multi-prod', type: 'project', status: 'active' });
    });

    it('two producers coexist without conflict', () => {
      registry.updateFields('multi-prod', { tech_stack: ['typescript'] }, 'fctry');
      registry.updateFields('multi-prod', { stakeholders: 'Team A' }, 'chorus');

      const p = registry.getProject('multi-prod', 'full')!;
      const fields = p.fields as Record<string, unknown>;
      expect(fields.tech_stack).toBeDefined();
      expect(fields.stakeholders).toBeDefined();
    });

    it('producer B cannot overwrite producer A fields', () => {
      registry.updateFields('multi-prod', { tech_stack: ['typescript'] }, 'fctry');
      registry.updateFields('multi-prod', { tech_stack: ['python'] }, 'chorus'); // Should be ignored

      const p = registry.getProject('multi-prod', 'full')!;
      const fields = p.fields as Record<string, unknown>;
      expect(fields.tech_stack).toBe('["typescript"]');
    });
  });

  // ── S17: Batch Operations ──────────────────────────────────

  describe('batchUpdate (S17)', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        registry.register({ name: `active-${i}`, type: 'project', status: 'active' });
      }
      for (let i = 0; i < 5; i++) {
        registry.register({ name: `paused-${i}`, type: 'project', status: 'paused' });
      }
    });

    it('updates all matching projects atomically', () => {
      const result = registry.batchUpdate({ status_filter: 'paused', status: 'archived' });
      expect(result.count).toBe(5);
      expect(result.projects.length).toBe(5);
      expect(result.dry_run).toBe(false);

      const active = registry.listProjects({ status_filter: 'active' });
      expect(active.length).toBe(10);
    });

    it('dry_run returns list without modifying', () => {
      const result = registry.batchUpdate({ status_filter: 'paused', status: 'archived', dry_run: true });
      expect(result.count).toBe(5);
      expect(result.dry_run).toBe(true);

      // Should NOT have changed anything
      const paused = registry.listProjects({ status_filter: 'paused' });
      expect(paused.length).toBe(5);
    });

    it('requires at least one filter', () => {
      expect(() => registry.batchUpdate({ status: 'archived' }))
        .toThrow('at least one filter');
    });
  });

  // ── S08: Port Management ───────────────────────────────────

  describe('ports (S08)', () => {
    beforeEach(() => {
      registry.register({ name: 'port-proj', type: 'project', status: 'active' });
      registry.register({ name: 'other-proj', type: 'project', status: 'active' });
    });

    it('claims a specific port', () => {
      const port = registry.claimPort('port-proj', 'dev server', 3000);
      expect(port).toBe(3000);
    });

    it('rejects duplicate port claim with owner info', () => {
      registry.claimPort('port-proj', 'dev server', 3000);
      expect(() => registry.claimPort('other-proj', 'api', 3000))
        .toThrow(/already claimed by port-proj/);
    });

    it('auto-allocates from 3000-9999', () => {
      const port = registry.claimPort('port-proj', 'api');
      expect(port).toBeGreaterThanOrEqual(3000);
      expect(port).toBeLessThanOrEqual(9999);
    });

    it('release is idempotent', () => {
      registry.claimPort('port-proj', 'dev', 3000);
      expect(registry.releasePort('port-proj', 3000)).toBe(true);
      expect(registry.releasePort('port-proj', 3000)).toBe(false); // no-op
    });

    it('checkPort reports availability', () => {
      expect(registry.checkPort(3000).available).toBe(true);
      registry.claimPort('port-proj', 'dev', 3000);
      const check = registry.checkPort(3000);
      expect(check.available).toBe(false);
      expect(check.project).toBe('port-proj');
    });

    it('ports appear in switchProject', () => {
      registry.claimPort('port-proj', 'dev server', 3000);
      const ctx = registry.switchProject('port-proj');
      expect(ctx.ports).toBeDefined();
    });
  });

  // ── S10: Capabilities ──────────────────────────────────────

  describe('capabilities (S10)', () => {
    beforeEach(() => {
      registry.register({ name: 'cap-proj', type: 'project', status: 'active' });
    });

    it('registers and queries capabilities', () => {
      registry.registerCapabilities('cap-proj', [
        { name: 'search', capability_type: 'mcp-tool', description: 'Search things' },
        { name: 'list', capability_type: 'mcp-tool', description: 'List items' },
      ]);

      const caps = registry.queryCapabilities({ project_name: 'cap-proj' });
      expect(caps.length).toBe(2);
    });

    it('replace semantics — second write replaces first', () => {
      registry.registerCapabilities('cap-proj', [
        { name: 'old', capability_type: 'cli', description: 'Old command' },
      ]);
      registry.registerCapabilities('cap-proj', [
        { name: 'new', capability_type: 'cli', description: 'New command' },
      ]);

      const caps = registry.queryCapabilities({ project_name: 'cap-proj' });
      expect(caps.length).toBe(1);
      expect(caps[0].name).toBe('new');
    });

    it('queries by type across projects', () => {
      registry.register({ name: 'proj2', type: 'project', status: 'active' });
      registry.registerCapabilities('cap-proj', [
        { name: 'tool1', capability_type: 'mcp-tool', description: 'Tool 1' },
      ]);
      registry.registerCapabilities('proj2', [
        { name: 'tool2', capability_type: 'mcp-tool', description: 'Tool 2' },
        { name: 'cmd1', capability_type: 'cli', description: 'CLI cmd' },
      ]);

      const mcpTools = registry.queryCapabilities({ capability_type: 'mcp-tool' });
      expect(mcpTools.length).toBe(2);
    });

    it('keyword search across names and descriptions', () => {
      registry.registerCapabilities('cap-proj', [
        { name: 'mail_search', capability_type: 'mcp-tool', description: 'Search emails' },
        { name: 'list_items', capability_type: 'mcp-tool', description: 'List all items' },
      ]);

      const results = registry.queryCapabilities({ keyword: 'search' });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('mail_search');
    });
  });

  // ── S20: Archive Cleanup ───────────────────────────────────

  describe('archiveProject (S20)', () => {
    it('releases ports and clears capabilities on archive', () => {
      registry.register({ name: 'to-archive', type: 'project', status: 'active' });
      registry.claimPort('to-archive', 'dev', 3000);
      registry.registerCapabilities('to-archive', [
        { name: 'cap1', capability_type: 'mcp-tool', description: 'Tool' },
      ]);

      const result = registry.archiveProject('to-archive');
      expect(result.ports_released).toBe(1);
      expect(result.capabilities_cleared).toBe(1);

      // Port should be free
      expect(registry.checkPort(3000).available).toBe(true);

      // Capabilities should be empty
      expect(registry.queryCapabilities({ project_name: 'to-archive' })).toEqual([]);

      // Project still queryable
      const p = registry.getProject('to-archive')!;
      expect(p.status).toBe('archived');
    });
  });

  // ── S18 / S29: Tasks ───────────────────────────────────────

  describe('tasks (S18, S29)', () => {
    beforeEach(() => {
      registry.register({ name: 'task-proj', type: 'project', status: 'active' });
    });

    it('queues and lists a task', () => {
      const result = registry.queueTask({
        description: 'Research pricing',
        project_name: 'task-proj',
        schedule: 'tonight',
      });
      expect(result.task_id).toBeDefined();

      const tasks = registry.listTasks({ status_filter: 'pending' });
      expect(tasks.length).toBe(1);
      expect(tasks[0].description).toBe('Research pricing');
    });

    it('fan-out dispatch creates independent tasks', () => {
      for (let i = 0; i < 5; i++) {
        registry.register({ name: `fan-${i}`, type: 'project', status: 'active' });
      }

      const result = registry.queueTask({
        description: 'Update CLAUDE.md',
        schedule: 'now',
        type_filter: 'project',
        status_filter: 'active',
      });

      expect(result.count).toBe(6); // 5 fan-* + task-proj
      expect(result.projects!.length).toBe(6);

      const tasks = registry.listTasks({ status_filter: 'pending' });
      expect(tasks.length).toBe(6);
    });
  });
});
