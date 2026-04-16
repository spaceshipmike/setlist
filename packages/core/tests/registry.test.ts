import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, MemoryStore, MemoryRetrieval } from '../src/index.js';

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
      expect(project!.goals).toEqual(['Test goals']);
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

    it('rejects legacy area_of_focus type with a clear error', () => {
      expect(() => registry.register({ name: 'bad', type: 'area_of_focus' as unknown as 'project', status: 'active' }))
        .toThrow(/area_of_focus/);
    });

    it('validates status against type', () => {
      expect(() => registry.register({ name: 'bad', type: 'project', status: 'not-a-status' }))
        .toThrow('Invalid status');
    });

    // spec 0.13 S74: register with an area attaches structural area_id.
    it('registers with an area assignment (S74)', () => {
      registry.register({ name: 'work-proj', type: 'project', status: 'active', area: 'Work' });
      const p = registry.getProject('work-proj', 'full')!;
      expect(p.area).toBe('Work');
      expect(p.parent_project).toBeNull();
      expect(p.children).toEqual([]);
    });

    // spec 0.13 S77: invalid area name is rejected with a listing of valid areas.
    it('rejects invalid area name at registration (S77)', () => {
      expect(() => registry.register({ name: 'bad-area', type: 'project', status: 'active', area: 'NotARealArea' }))
        .toThrow(/NotARealArea.*Work.*Family.*Home.*Health.*Finance.*Personal.*Infrastructure/s);
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
          // spec 0.13: first 2 in Work, next 2 in Home, last in Infrastructure
          area: i < 2 ? 'Work' : i < 4 ? 'Home' : 'Infrastructure',
        });
        registry.updateFields(`proj-${i}`, { tech_stack: ['typescript', 'sqlite'] }, 'fctry');
      }
      // One unassigned project to exercise the __unassigned__ sentinel
      registry.register({ name: 'loose-proj', type: 'project', status: 'active', description: 'No area yet' });
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
      // spec 0.13: area/parent_project/children are always present at summary depth
      expect(p.area).toBe('Work');
      expect(p.parent_project).toBeNull();
      expect(p.children).toEqual([]);
      // Should NOT have extended fields or paths at summary
      expect(p.goals).toBeUndefined();
      expect(p.fields).toBeUndefined();
      expect(p.paths).toBeUndefined();
    });

    it('standard depth adds goals, paths, template fields', () => {
      const p = registry.getProject('proj-0', 'standard')!;
      expect(p.goals).toEqual(['Goal 0']);
      expect(p.paths).toEqual(['/path/0']);
      expect(p.fields).toBeDefined();
    });

    it('full depth includes everything', () => {
      const p = registry.getProject('proj-0', 'full')!;
      expect(p.created_at).toBeDefined();
      expect(p.updated_at).toBeDefined();
    });

    it('type_filter "project" matches every row (spec 0.13 narrows type)', () => {
      const projects = registry.listProjects({ type_filter: 'project' });
      expect(projects.every(p => p.type === 'project')).toBe(true);
      expect(projects.length).toBe(6);
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

    // spec 0.13 S74: area_filter selects only projects in a named area.
    it('area_filter narrows to a single area', () => {
      const work = registry.listProjects({ area_filter: 'Work' });
      expect(work.length).toBe(2);
      expect(work.every(p => p.area === 'Work')).toBe(true);
    });

    // spec 0.13 S74: __unassigned__ sentinel matches area_id IS NULL.
    it('area_filter __unassigned__ returns only unassigned projects', () => {
      const unassigned = registry.listProjects({ area_filter: '__unassigned__' });
      expect(unassigned.length).toBe(1);
      expect(unassigned[0].name).toBe('loose-proj');
      expect(unassigned[0].area).toBeNull();
    });

    it('area_filter rejects unknown area names (S77)', () => {
      expect(() => registry.listProjects({ area_filter: 'Nope' })).toThrow(/Nope/);
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
    it('returns correct counts with per-area distribution', () => {
      registry.register({ name: 'p1', type: 'project', status: 'active', area: 'Work' });
      registry.register({ name: 'p2', type: 'project', status: 'paused', area: 'Work' });
      registry.register({ name: 'p3', type: 'project', status: 'active', area: 'Home' });
      registry.register({ name: 'loose', type: 'project', status: 'active' });

      const stats = registry.getRegistryStats();
      expect(stats.total).toBe(4);
      expect(stats.by_type.project).toBe(4);
      expect(stats.by_status.active).toBe(3);
      expect(stats.by_status.paused).toBe(1);

      // spec 0.13: by_area includes all 7 canonical areas (zero for unused)
      expect(stats.by_area.Work).toBe(2);
      expect(stats.by_area.Home).toBe(1);
      expect(stats.by_area.Health).toBe(0);
      expect(stats.by_area.Infrastructure).toBe(0);
      expect(stats.unassigned).toBe(1);
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

    it('tasks have all required fields (S29)', () => {
      registry.queueTask({
        description: 'Research pricing',
        project_name: 'task-proj',
        schedule: 'tonight',
      });

      const tasks = registry.listTasks({});
      expect(tasks.length).toBe(1);
      const task = tasks[0] as Record<string, unknown>;
      expect(task.id).toBeDefined();
      expect(task.project_name).toBe('task-proj');
      expect(task.description).toBe('Research pricing');
      expect(task.schedule).toBe('tonight');
      expect(task.status).toBe('pending');
      expect(task.created_at).toBeTruthy();
      expect(task.session_reference).toBeNull();
    });

    it('list_tasks filters by project_name (S29)', () => {
      registry.register({ name: 'other-task-proj', type: 'project', status: 'active' });

      registry.queueTask({ description: 'Task A', project_name: 'task-proj', schedule: 'now' });
      registry.queueTask({ description: 'Task B', project_name: 'other-task-proj', schedule: 'now' });

      const filtered = registry.listTasks({ project_name: 'task-proj' });
      expect(filtered.length).toBe(1);
      expect((filtered[0] as Record<string, unknown>).description).toBe('Task A');
    });

    it('supports all three schedule types (S29)', () => {
      registry.queueTask({ description: 'Now task', project_name: 'task-proj', schedule: 'now' });
      registry.queueTask({ description: 'Tonight task', project_name: 'task-proj', schedule: 'tonight' });
      registry.queueTask({ description: 'Weekly task', project_name: 'task-proj', schedule: 'weekly' });

      const tasks = registry.listTasks({});
      expect(tasks.length).toBe(3);
      const schedules = tasks.map((t: Record<string, unknown>) => t.schedule);
      expect(schedules).toContain('now');
      expect(schedules).toContain('tonight');
      expect(schedules).toContain('weekly');
    });

    it('global tasks have null project_name (S29)', () => {
      registry.queueTask({ description: 'Global task', schedule: 'now' });

      const tasks = registry.listTasks({});
      expect(tasks.length).toBe(1);
      expect((tasks[0] as Record<string, unknown>).project_name).toBeNull();
    });
  });

  // ── S17: Batch atomicity ───────────────────────────────────

  describe('batchUpdate atomicity (S17)', () => {
    it('batch archive releases ports and clears capabilities', () => {
      registry.register({ name: 'ba-1', type: 'project', status: 'paused' });
      registry.register({ name: 'ba-2', type: 'project', status: 'paused' });
      registry.claimPort('ba-1', 'dev', 5500);
      registry.claimPort('ba-2', 'dev', 5501);
      registry.registerCapabilities('ba-1', [{ name: 'tool1', capability_type: 'mcp', description: 'test' }]);

      const result = registry.batchUpdate({ status_filter: 'paused', status: 'archived' });
      expect(result.count).toBe(2);

      // Ports should be released
      expect(registry.checkPort(5500).available).toBe(true);
      expect(registry.checkPort(5501).available).toBe(true);

      // Capabilities should be cleared
      const caps = registry.queryCapabilities({ project_name: 'ba-1' });
      expect(caps.length).toBe(0);
    });

    it('batch requires at least one field to update', () => {
      expect(() => registry.batchUpdate({ status_filter: 'active' }))
        .toThrow('at least one field');
    });
  });

  // ── S31: Project Rename ──────────────────────────────────────

  describe('renameProject (S31)', () => {
    beforeEach(() => {
      registry.register({
        name: 'old-name', type: 'project', status: 'active',
        description: 'Test project', goals: 'Testing rename',
        display_name: 'Old Project', paths: ['/tmp/old-name'],
      });
    });

    it('renames a project and makes it queryable under the new name', () => {
      registry.renameProject('old-name', 'new-name');

      const proj = registry.getProject('new-name', 'full');
      expect(proj).not.toBeNull();
      expect(proj!.name).toBe('new-name');
      expect(proj!.description).toBe('Test project');
      expect(proj!.display_name).toBe('Old Project');
    });

    it('old name returns NOT_FOUND after rename', () => {
      registry.renameProject('old-name', 'new-name');
      const proj = registry.getProject('old-name');
      expect(proj).toBeNull();
    });

    it('preserves port claims under the new name', () => {
      registry.claimPort('old-name', 'dev server', 4500);
      registry.renameProject('old-name', 'new-name');

      const check = registry.checkPort(4500);
      expect(check.available).toBe(false);
      expect(check.project).toBe('new-name');
    });

    it('preserves capabilities under the new name', () => {
      registry.registerCapabilities('old-name', [
        { name: 'search', capability_type: 'mcp-tool', description: 'Search' },
      ]);
      registry.renameProject('old-name', 'new-name');

      const caps = registry.queryCapabilities({ project_name: 'new-name' });
      expect(caps).toHaveLength(1);
      expect(caps[0].name).toBe('search');

      const oldCaps = registry.queryCapabilities({ project_name: 'old-name' });
      expect(oldCaps).toHaveLength(0);
    });

    it('rewrites task references to the new name', () => {
      registry.queueTask({ description: 'Build docs', project_name: 'old-name', schedule: 'now' });
      registry.renameProject('old-name', 'new-name');

      const tasks = registry.listTasks({ project_name: 'new-name' });
      expect(tasks).toHaveLength(1);

      const oldTasks = registry.listTasks({ project_name: 'old-name' });
      expect(oldTasks).toHaveLength(0);
    });

    it('rewrites memory references to the new name', () => {
      const dbFile = join(tmpDir, 'test.db');
      const ms = new MemoryStore(dbFile);
      ms.retain({ content: 'Use SQLite', type: 'decision', project_id: 'old-name' });

      registry.renameProject('old-name', 'new-name');

      const mr = new MemoryRetrieval(dbFile);
      const results = mr.recall({ query: 'SQLite', project_id: 'new-name' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('preserves filesystem paths under the new name', () => {
      registry.renameProject('old-name', 'new-name');
      const proj = registry.getProject('new-name', 'full');
      expect(proj!.paths).toContain('/tmp/old-name');
    });

    it('preserves extended fields and producer attribution', () => {
      registry.updateFields('old-name', { tech_stack: ['typescript'] }, 'fctry');
      registry.renameProject('old-name', 'new-name');

      const proj = registry.getProject('new-name', 'full') as Record<string, unknown>;
      const fields = proj.fields as Record<string, unknown>;
      expect(fields.tech_stack).toBeDefined();
    });

    it('rejects rename to an existing project name', () => {
      registry.register({ name: 'taken-name', type: 'project', status: 'active' });
      expect(() => registry.renameProject('old-name', 'taken-name'))
        .toThrow(/taken-name/);
    });

    it('throws NOT_FOUND for non-existent source name', () => {
      expect(() => registry.renameProject('nonexistent', 'new-name'))
        .toThrow('NOT_FOUND');
    });

    it('old name is available for re-registration after rename', () => {
      registry.renameProject('old-name', 'new-name');
      registry.register({ name: 'old-name', type: 'project', status: 'active' });
      const proj = registry.getProject('old-name');
      expect(proj).not.toBeNull();
    });
  });

  // ── Spec 0.13: Areas + Sub-Projects (S74–S80) ─────────────

  describe('areas and sub-projects (S74–S80)', () => {
    beforeEach(() => {
      registry.register({ name: 'solo', type: 'project', status: 'active' });
      registry.register({ name: 'parent-proj', type: 'project', status: 'active', area: 'Work' });
      registry.register({ name: 'child-a', type: 'project', status: 'active', area: 'Work' });
      registry.register({ name: 'child-b', type: 'project', status: 'active', area: 'Home' });
    });

    // S74
    it('setProjectArea assigns an area and clears it on null', () => {
      const r1 = registry.setProjectArea('solo', 'Work') as Record<string, unknown>;
      expect(r1.area).toBe('Work');
      const fetched = registry.getProject('solo', 'standard')!;
      expect(fetched.area).toBe('Work');

      const r2 = registry.setProjectArea('solo', null) as Record<string, unknown>;
      expect(r2.area).toBeNull();
    });

    // S77
    it('setProjectArea rejects unknown area names and lists valid ones', () => {
      expect(() => registry.setProjectArea('solo', 'Nope'))
        .toThrow(/Nope.*Work.*Family.*Home.*Health.*Finance.*Personal.*Infrastructure/s);
    });

    // S77: case-sensitive — 'work' lowercase is not accepted
    it('setProjectArea is case-sensitive', () => {
      expect(() => registry.setProjectArea('solo', 'work')).toThrow(/work/);
    });

    // S74
    it('setProjectArea leaves other fields untouched', () => {
      const before = registry.getProject('parent-proj', 'full')!;
      registry.setProjectArea('parent-proj', 'Home');
      const after = registry.getProject('parent-proj', 'full')!;
      expect(after.area).toBe('Home');
      expect(after.description).toBe(before.description);
      expect(after.status).toBe(before.status);
    });

    // S75
    it('setParentProject links child to parent and reflects both directions', () => {
      registry.setParentProject('child-a', 'parent-proj');
      const child = registry.getProject('child-a', 'full')!;
      expect(child.parent_project).toBe('parent-proj');
      const parent = registry.getProject('parent-proj', 'full')!;
      expect(parent.children).toContain('child-a');
    });

    // S75
    it('setParentProject(null) detaches from current parent', () => {
      registry.setParentProject('child-a', 'parent-proj');
      registry.setParentProject('child-a', null);
      const child = registry.getProject('child-a', 'full')!;
      expect(child.parent_project).toBeNull();
      const parent = registry.getProject('parent-proj', 'full')!;
      expect(parent.children).not.toContain('child-a');
    });

    // S75: cross-area parenting is allowed
    it('setParentProject allows cross-area parenting', () => {
      // child-b is Home, parent-proj is Work
      registry.setParentProject('child-b', 'parent-proj');
      const child = registry.getProject('child-b', 'full')!;
      expect(child.parent_project).toBe('parent-proj');
      expect(child.area).toBe('Home');
    });

    // S75: missing parent is NOT_FOUND with fuzzy suggestion
    it('setParentProject with nonexistent parent throws NOT_FOUND', () => {
      expect(() => registry.setParentProject('child-a', 'parrent-proj'))
        .toThrow(/NOT_FOUND/);
    });

    // S76: self-parenting
    it('setParentProject rejects self-parenting', () => {
      expect(() => registry.setParentProject('parent-proj', 'parent-proj'))
        .toThrow(/is a descendant of.*Moving it would create a cycle/);
    });

    // S76: A → B → C, then A as child of C would cycle
    it('setParentProject rejects cycle creation and leaves state unchanged', () => {
      registry.register({ name: 'a', type: 'project', status: 'active' });
      registry.register({ name: 'b', type: 'project', status: 'active' });
      registry.register({ name: 'c', type: 'project', status: 'active' });
      registry.setParentProject('b', 'a'); // a -> b
      registry.setParentProject('c', 'b'); // a -> b -> c

      expect(() => registry.setParentProject('a', 'c'))
        .toThrow(/Cannot set parent: a is a descendant of c\. Moving it would create a cycle\./);

      // State unchanged
      expect(registry.getProject('a', 'full')!.parent_project).toBeNull();
      expect(registry.getProject('b', 'full')!.parent_project).toBe('a');
      expect(registry.getProject('c', 'full')!.parent_project).toBe('b');
    });

    // S79: parent archive does NOT cascade to children; child link preserved
    // with parent_archived flag.
    it('archiving parent leaves children active and marks parent_archived', () => {
      registry.setParentProject('child-a', 'parent-proj');
      registry.archiveProject('parent-proj');

      const child = registry.getProject('child-a', 'full')!;
      expect(child.status).toBe('active');
      expect(child.parent_project).toBe('parent-proj');
      expect(child.parent_archived).toBe(true);
    });

    // S80: getProject returns area/parent_project/children at all depths
    it('getProject returns area, parent_project, children at full depth', () => {
      registry.register({ name: 'portfolio-root', type: 'project', status: 'active' });
      registry.setParentProject('parent-proj', 'portfolio-root');
      registry.setParentProject('child-a', 'parent-proj');
      registry.register({ name: 'child-c', type: 'project', status: 'active', area: 'Work' });
      registry.setParentProject('child-c', 'parent-proj');

      const p = registry.getProject('parent-proj', 'full')!;
      expect(p.area).toBe('Work');
      expect(p.parent_project).toBe('portfolio-root');
      expect(p.children).toEqual(['child-a', 'child-c']);

      const solo = registry.getProject('solo', 'full')!;
      expect(solo.area).toBeNull();
      expect(solo.parent_project).toBeNull();
      expect(solo.children).toEqual([]);
    });

    // S80: consistency — querying a child returns same parent name
    it('parent/child relationship is consistent in both directions', () => {
      registry.setParentProject('child-a', 'parent-proj');
      const child = registry.getProject('child-a', 'full')!;
      const parent = registry.getProject('parent-proj', 'full')!;
      expect(parent.children).toContain(child.name);
      expect(child.parent_project).toBe(parent.name);
    });

    // S80: parent link survives a rename
    it('rename preserves parent link', () => {
      registry.setParentProject('child-a', 'parent-proj');
      registry.renameProject('parent-proj', 'renamed-parent');
      const child = registry.getProject('child-a', 'full')!;
      expect(child.parent_project).toBe('renamed-parent');
    });
  });

  // ── S78: Memory Bubble-Up Through Area ─────────────────────

  describe('memory scope bubble-up (S78)', () => {
    let dbFile: string;
    beforeEach(() => {
      dbFile = join(tmpDir, 'test.db');
      registry.register({ name: 'work-a', type: 'project', status: 'active', area: 'Work' });
      registry.register({ name: 'work-b', type: 'project', status: 'active', area: 'Work' });
      registry.register({ name: 'work-c', type: 'project', status: 'active', area: 'Work' });
      registry.register({ name: 'home-a', type: 'project', status: 'active', area: 'Home' });
      registry.register({ name: 'unassigned-a', type: 'project', status: 'active' });
    });

    it('siblings in same area see each others area-scoped memories', () => {
      const ms = new MemoryStore(dbFile);
      ms.retain({ content: 'Budget season ends March 31', type: 'decision', project_id: 'work-b', scope: 'area' });

      const mr = new MemoryRetrieval(dbFile);
      const results = mr.recall({ query: 'budget', project_id: 'work-a' });
      expect(results.some(r => r.content.includes('Budget season'))).toBe(true);
    });

    it('project-scoped memories do NOT bubble to siblings', () => {
      const ms = new MemoryStore(dbFile);
      ms.retain({ content: 'work-b internal note xyz42', type: 'decision', project_id: 'work-b', scope: 'project' });

      const mr = new MemoryRetrieval(dbFile);
      const results = mr.recall({ query: 'xyz42', project_id: 'work-a' });
      expect(results.some(r => r.content.includes('xyz42'))).toBe(false);
    });

    it('cross-area area memories are not visible', () => {
      const ms = new MemoryStore(dbFile);
      ms.retain({ content: 'Home paint colors abc99', type: 'decision', project_id: 'home-a', scope: 'area' });

      const mr = new MemoryRetrieval(dbFile);
      const results = mr.recall({ query: 'abc99', project_id: 'work-a' });
      expect(results.some(r => r.content.includes('abc99'))).toBe(false);
    });

    it('reassigning a project immediately changes its area pool', () => {
      const ms = new MemoryStore(dbFile);
      ms.retain({ content: 'Work zone secret def77', type: 'decision', project_id: 'work-b', scope: 'area' });

      const mr = new MemoryRetrieval(dbFile);
      const before = mr.recall({ query: 'def77', project_id: 'home-a' });
      expect(before.some(r => r.content.includes('def77'))).toBe(false);

      registry.setProjectArea('home-a', 'Work');
      const after = mr.recall({ query: 'def77', project_id: 'home-a' });
      expect(after.some(r => r.content.includes('def77'))).toBe(true);
    });

    it('unassigned project sees only project + portfolio + global', () => {
      const ms = new MemoryStore(dbFile);
      ms.retain({ content: 'Work area memory ghi55', type: 'decision', project_id: 'work-a', scope: 'area' });
      ms.retain({ content: 'Global fact jkl33', type: 'decision', scope: 'global' });
      ms.retain({ content: 'Portfolio brief mno11', type: 'decision', scope: 'portfolio' });
      ms.retain({ content: 'Unassigned own note pqr88', type: 'decision', project_id: 'unassigned-a', scope: 'project' });

      const mr = new MemoryRetrieval(dbFile);
      const results = mr.recall({ query: 'ghi55 jkl33 mno11 pqr88', project_id: 'unassigned-a' });
      const contents = results.map(r => r.content).join(' ');
      expect(contents).not.toContain('ghi55'); // area — blocked
      expect(contents).toContain('jkl33');     // global — allowed
      expect(contents).toContain('mno11');     // portfolio — allowed
      expect(contents).toContain('pqr88');     // own project — allowed
    });
  });
});
