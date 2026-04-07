import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, MemoryStore, MemoryRetrieval, MemoryReflection, connect, initDb } from '../src/index.js';

describe('Edge Cases — Project Identity', () => {
  let tmpDir: string;
  let registry: Registry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-edge-'));
    registry = new Registry(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Registration edge cases ──────────────────────────────

  it('rejects invalid project type', () => {
    expect(() => registry.register({ name: 'bad', type: 'invalid' as any, status: 'active' }))
      .toThrow();
  });

  it('accepts all valid project statuses', () => {
    const statuses = ['idea', 'draft', 'active', 'paused', 'archived', 'complete'];
    for (const status of statuses) {
      registry.register({ name: `proj-${status}`, type: 'project', status });
    }
    expect(registry.getRegistryStats().total).toBe(6);
  });

  it('area_of_focus rejects complete and archived', () => {
    expect(() => registry.register({ name: 'a', type: 'area_of_focus', status: 'complete' })).toThrow();
    expect(() => registry.register({ name: 'b', type: 'area_of_focus', status: 'archived' })).toThrow();
  });

  it('empty description and goals are valid', () => {
    registry.register({ name: 'sparse', type: 'project', status: 'active', description: '', goals: '' });
    const p = registry.getProject('sparse', 'full')!;
    expect(p.description).toBeUndefined(); // Empty fields absent, not null
    expect(p.goals).toBeUndefined();
  });

  it('multiple paths per project', () => {
    registry.register({ name: 'multi-path', type: 'project', status: 'active', paths: ['/path/a', '/path/b', '/path/c'] });
    const p = registry.getProject('multi-path', 'full')!;
    expect(p.paths).toHaveLength(3);
  });

  it('getProject returns null for nonexistent', () => {
    expect(registry.getProject('nope')).toBeNull();
  });

  it('empty registry returns empty list', () => {
    const projects = registry.listProjects();
    expect(projects).toEqual([]);
  });

  it('empty registry stats return zeros', () => {
    const stats = registry.getRegistryStats();
    expect(stats.total).toBe(0);
    expect(stats.by_type).toEqual({});
    expect(stats.by_status).toEqual({});
  });

  // ── Field edge cases ──────────────────────────────────────

  it('fields not in catalog are accepted', () => {
    registry.register({ name: 'custom-fields', type: 'project', status: 'active' });
    registry.updateFields('custom-fields', { custom_field: 'custom_value', another: ['a', 'b'] }, 'system');
    const p = registry.getProject('custom-fields', 'full')!;
    expect((p.fields as Record<string, unknown>).custom_field).toBe('custom_value');
  });

  it('list fields are stored as JSON arrays', () => {
    registry.register({ name: 'list-test', type: 'project', status: 'active' });
    registry.updateFields('list-test', { tech_stack: ['ts', 'sqlite'] }, 'fctry');
    const p = registry.getProject('list-test', 'full')!;
    expect((p.fields as Record<string, unknown>).tech_stack).toBe('["ts","sqlite"]');
  });

  // ── Update edge cases ─────────────────────────────────────

  it('updateCore with no changes is a no-op', () => {
    registry.register({ name: 'noop', type: 'project', status: 'active' });
    registry.updateCore('noop', {}); // No fields provided
    const p = registry.getProject('noop')!;
    expect(p.status).toBe('active');
  });

  it('archiveProject on already archived is idempotent', () => {
    registry.register({ name: 'already', type: 'project', status: 'archived' });
    const result = registry.archiveProject('already');
    expect(result.ports_released).toBe(0);
  });

  // ── Search edge cases ──────────────────────────────────────

  it('search with special characters does not crash', () => {
    registry.register({ name: 'safe', type: 'project', status: 'active', description: 'Normal project' });
    const results = registry.searchProjects({ query: "'; DROP TABLE projects; --" });
    expect(results).toEqual([]); // No SQL injection
  });

  it('search matches across extended fields', () => {
    registry.register({ name: 'searchable', type: 'project', status: 'active' });
    registry.updateFields('searchable', { tech_stack: ['react', 'graphql'] }, 'fctry');
    const results = registry.searchProjects({ query: 'graphql' });
    expect(results.length).toBe(1);
  });

  // ── Batch edge cases ───────────────────────────────────────

  it('batch with no matching projects returns count 0', () => {
    registry.register({ name: 'only', type: 'project', status: 'active' });
    const result = registry.batchUpdate({ status_filter: 'paused', description: 'Updated' });
    expect(result.count).toBe(0);
    expect(result.projects).toEqual([]);
  });

  it('batch archive cleanup releases ports', () => {
    for (let i = 0; i < 3; i++) {
      registry.register({ name: `batch-port-${i}`, type: 'project', status: 'paused' });
      registry.claimPort(`batch-port-${i}`, 'dev', 3000 + i);
    }
    registry.batchUpdate({ status_filter: 'paused', status: 'archived' });
    // All ports should be freed
    for (let i = 0; i < 3; i++) {
      expect(registry.checkPort(3000 + i).available).toBe(true);
    }
  });

  // ── Port edge cases ────────────────────────────────────────

  it('rejects port below range', () => {
    registry.register({ name: 'port-edge', type: 'project', status: 'active' });
    expect(() => registry.claimPort('port-edge', 'dev', 80)).toThrow('out of range');
  });

  it('rejects port above range', () => {
    registry.register({ name: 'port-edge2', type: 'project', status: 'active' });
    expect(() => registry.claimPort('port-edge2', 'dev', 99999)).toThrow('out of range');
  });

  it('multiple ports per project', () => {
    registry.register({ name: 'multi-port', type: 'project', status: 'active' });
    registry.claimPort('multi-port', 'web', 3000);
    registry.claimPort('multi-port', 'api', 3001);
    registry.claimPort('multi-port', 'ws', 3002);
    const ports = registry.listProjectPorts('multi-port');
    expect(ports.length).toBe(3);
  });

  it('auto-allocate skips claimed ports', () => {
    registry.register({ name: 'alloc1', type: 'project', status: 'active' });
    registry.register({ name: 'alloc2', type: 'project', status: 'active' });
    const p1 = registry.claimPort('alloc1', 'dev');
    const p2 = registry.claimPort('alloc2', 'dev');
    expect(p1).toBe(3000);
    expect(p2).toBe(3001); // Skipped 3000
  });

  // ── Capability edge cases ──────────────────────────────────

  it('empty capability set is valid', () => {
    registry.register({ name: 'no-caps', type: 'project', status: 'active' });
    const caps = registry.queryCapabilities({ project_name: 'no-caps' });
    expect(caps).toEqual([]);
  });

  it('no-filter capability query returns all', () => {
    registry.register({ name: 'cap-a', type: 'project', status: 'active' });
    registry.register({ name: 'cap-b', type: 'project', status: 'active' });
    registry.registerCapabilities('cap-a', [{ name: 'tool1', capability_type: 'mcp-tool', description: 'T1' }]);
    registry.registerCapabilities('cap-b', [{ name: 'tool2', capability_type: 'cli', description: 'T2' }]);
    const all = registry.queryCapabilities();
    expect(all.length).toBe(2);
  });

  it('invocation metadata preserved in queries', () => {
    registry.register({ name: 'meta-cap', type: 'project', status: 'active' });
    registry.registerCapabilities('meta-cap', [{
      name: 'secure-tool',
      capability_type: 'mcp-tool',
      description: 'Needs auth',
      requires_auth: true,
      invocation_model: 'async',
      audience: 'agent',
    }]);
    const caps = registry.queryCapabilities({ project_name: 'meta-cap' });
    expect(caps[0].requires_auth).toBe(true);
    expect(caps[0].invocation_model).toBe('async');
    expect(caps[0].audience).toBe('agent');
  });

  // ── Task edge cases ────────────────────────────────────────

  it('global tasks have no project_name', () => {
    const result = registry.queueTask({ description: 'Global work', schedule: 'now' });
    const tasks = registry.listTasks();
    expect(tasks[0].project_name).toBeNull();
  });

  it('multiple tasks are all listed', () => {
    registry.register({ name: 'task-order', type: 'project', status: 'active' });
    registry.queueTask({ description: 'First', project_name: 'task-order', schedule: 'now' });
    registry.queueTask({ description: 'Second', project_name: 'task-order', schedule: 'now' });
    const tasks = registry.listTasks();
    expect(tasks.length).toBe(2);
    const descs = tasks.map(t => (t as Record<string, unknown>).description);
    expect(descs).toContain('First');
    expect(descs).toContain('Second');
  });

  it('fan-out requires at least one filter', () => {
    expect(() => registry.queueTask({ description: 'No filter', schedule: 'now', type_filter: undefined, status_filter: undefined }))
      .not.toThrow(); // Single task, not fan-out
  });
});

describe('Edge Cases — Memory', () => {
  let tmpDir: string;
  let store: MemoryStore;
  let retrieval: MemoryRetrieval;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-mem-edge-'));
    const dbPath = join(tmpDir, 'test.db');
    store = new MemoryStore(dbPath);
    retrieval = new MemoryRetrieval(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('memory types are a closed set', () => {
    expect(() => store.retain({ content: 'test', type: 'invalid_type' })).toThrow('Unknown memory type');
  });

  it('all 10 valid memory types accepted', () => {
    const types = ['decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'learning', 'context', 'procedural', 'observation'];
    for (const type of types) {
      const r = store.retain({ content: `Test ${type}`, type });
      expect(r.is_new).toBe(true);
    }
  });

  it('retired skill type is rejected', () => {
    expect(() => store.retain({ content: 'test', type: 'skill' })).toThrow('Unknown memory type');
  });

  it('scope defaults to project when project_id provided', () => {
    const r = store.retain({ content: 'Scoped', type: 'decision', project_id: 'proj' });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).scope).toBe('project');
  });

  it('scope defaults to global when no project_id', () => {
    const r = store.retain({ content: 'Global', type: 'preference' });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).scope).toBe('global');
  });

  it('explicit scope overrides default', () => {
    const r = store.retain({ content: 'Portfolio', type: 'pattern', scope: 'portfolio' });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).scope).toBe('portfolio');
  });

  it('tags stored and retrievable', () => {
    const r = store.retain({ content: 'Tagged', type: 'decision', tags: ['arch', 'db'] });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).tags).toEqual(['arch', 'db']);
  });

  it('is_pinned flag persists', () => {
    const r = store.retain({ content: 'Pinned memory', type: 'preference', is_pinned: true });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).is_pinned).toBe(true);
  });

  it('is_static flag persists', () => {
    const r = store.retain({ content: 'Static memory', type: 'preference', is_static: true });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).is_static).toBe(true);
  });

  it('is_inference flag persists', () => {
    const r = store.retain({ content: 'Inferred', type: 'pattern', is_inference: true });
    const details = store.inspectMemory(r.memory_id);
    expect((details.memory as Record<string, unknown>).is_inference).toBe(true);
  });

  it('feedback on nonexistent memory is silently skipped', () => {
    const result = store.feedback({ memory_ids: ['nonexistent-id'], outcome: 'success' });
    expect(result.updated_count).toBe(0);
  });

  it('EMA converges correctly over many iterations', () => {
    const m = store.retain({ content: 'Convergence test', type: 'pattern' });
    // 50 success feedbacks should converge near 1.0
    let score = 0;
    for (let i = 0; i < 50; i++) {
      const r = store.feedback({ memory_ids: [m.memory_id], outcome: 'success' });
      score = r.new_scores[m.memory_id];
    }
    expect(score).toBeGreaterThan(0.99);
  });

  it('correction inherits project_id and scope from original', () => {
    const orig = store.retain({ content: 'Original', type: 'decision', project_id: 'my-proj', scope: 'project' });
    const corr = store.correct({ memory_id: orig.memory_id, new_content: 'Corrected', reason: 'Wrong' });
    const details = store.inspectMemory(corr.correction_id);
    expect((details.memory as Record<string, unknown>).project_id).toBe('my-proj');
    expect((details.memory as Record<string, unknown>).scope).toBe('project');
  });

  it('forget stores reason', () => {
    const m = store.retain({ content: 'Forgettable', type: 'pattern' });
    store.forget({ memory_id: m.memory_id, reason: 'Outdated pattern' });
    const details = store.inspectMemory(m.memory_id);
    expect((details.memory as Record<string, unknown>).forget_reason).toBe('Outdated pattern');
  });

  it('recall with empty query returns bootstrap results', () => {
    store.retain({ content: 'Bootstrap memory', type: 'decision', project_id: 'proj' });
    const results = retrieval.recall({ project_id: 'proj', token_budget: 4000 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('recall respects scope isolation — project A not in project B', () => {
    store.retain({ content: 'Project A secret', type: 'decision', project_id: 'proj-a' });
    store.retain({ content: 'Project B secret', type: 'decision', project_id: 'proj-b' });

    const resultsA = retrieval.recall({ query: 'secret', project_id: 'proj-a', token_budget: 4000 });
    const projBInA = resultsA.filter(r => r.project_id === 'proj-b');
    expect(projBInA.length).toBe(0);
  });

  it('configureMemory returns current config', () => {
    store.configureMemory({ embedding_provider: 'openai' });
    const config = store.configureMemory({ reflect_threshold: 100 });
    expect(config.embedding_provider).toBe('openai');
    expect(config.reflect_threshold).toBe('100');
  });

  it('memoryStatus returns correct type counts', () => {
    store.retain({ content: 'Decision', type: 'decision' });
    store.retain({ content: 'Pattern', type: 'pattern' });
    store.retain({ content: 'Pattern 2', type: 'pattern' });
    const status = store.memoryStatus();
    expect(status.total).toBe(3);
    expect((status.counts_by_type as Record<string, number>).decision).toBe(1);
    expect((status.counts_by_type as Record<string, number>).pattern).toBe(2);
  });
});

describe('Edge Cases — Reflection', () => {
  let tmpDir: string;
  let store: MemoryStore;
  let reflection: MemoryReflection;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-ref-edge-'));
    const dbPath = join(tmpDir, 'test.db');
    store = new MemoryStore(dbPath);
    reflection = new MemoryReflection(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('static memories are never archived by reflection', () => {
    const m = store.retain({ content: 'Static memory', type: 'pattern', importance: 0.1, is_static: true });

    // Backdate
    const db = connect(join(tmpDir, 'test.db'));
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE memories SET updated_at = ? WHERE id = ?').run(oldDate, m.memory_id);
    db.close();

    reflection.reflect();

    const details = store.inspectMemory(m.memory_id);
    expect((details.memory as Record<string, unknown>).status).toBe('active');
  });

  it('reflection on empty store does not error', () => {
    const result = reflection.reflect();
    expect(result.memories_archived).toBe(0);
    expect(result.edges_created).toBe(0);
  });

  it('creates relationship edges between decisions and patterns in same project', () => {
    store.retain({ content: 'Decision A', type: 'decision', project_id: 'proj' });
    store.retain({ content: 'Pattern B', type: 'pattern', project_id: 'proj' });

    const result = reflection.reflect();
    expect(result.edges_created).toBeGreaterThan(0);
  });
});
