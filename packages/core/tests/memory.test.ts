import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryStore, MemoryRetrieval, Registry } from '../src/index.js';

describe('Memory', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: MemoryStore;
  let retrieval: MemoryRetrieval;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-mem-'));
    dbPath = join(tmpDir, 'test.db');
    store = new MemoryStore(dbPath);
    retrieval = new MemoryRetrieval(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── S11: Retain and Dedup ──────────────────────────────────

  describe('retain and dedup (S11)', () => {
    it('creates a new memory', () => {
      const result = store.retain({
        content: 'Use SQLite for storage',
        type: 'decision',
        project_id: 'my-project',
      });
      expect(result.is_new).toBe(true);
      expect(result.memory_id).toBeTruthy();
      expect(result.reinforcement_count).toBe(1);
    });

    it('reinforces on duplicate content', () => {
      const first = store.retain({ content: 'Use SQLite for storage', type: 'decision', project_id: 'my-project' });
      const second = store.retain({ content: 'Use SQLite for storage', type: 'decision', project_id: 'my-project' });

      expect(second.is_new).toBe(false);
      expect(second.memory_id).toBe(first.memory_id);
      expect(second.reinforcement_count).toBe(2);
    });

    it('normalizes content for hashing (whitespace)', () => {
      const first = store.retain({ content: '  Use SQLite  for   storage  ', type: 'decision', project_id: 'proj' });
      const second = store.retain({ content: 'Use SQLite for storage', type: 'decision', project_id: 'proj' });
      expect(second.is_new).toBe(false);
      expect(second.memory_id).toBe(first.memory_id);
    });

    it('different types produce different memories', () => {
      const a = store.retain({ content: 'SQLite', type: 'decision', project_id: 'proj' });
      const b = store.retain({ content: 'SQLite', type: 'pattern', project_id: 'proj' });
      expect(b.memory_id).not.toBe(a.memory_id);
    });

    it('rejects unknown memory type', () => {
      expect(() => store.retain({ content: 'test', type: 'invalid' }))
        .toThrow('Unknown memory type');
    });

    it('correction gets minimum importance of 0.9', () => {
      const result = store.retain({
        content: 'Always use kebab-case',
        type: 'correction',
        importance: 0.3,
      });

      const details = store.inspectMemory(result.memory_id);
      const mem = details.memory as Record<string, unknown>;
      expect(mem.importance).toBeGreaterThanOrEqual(0.9);
    });

    it('global scope when no project_id', () => {
      const result = store.retain({ content: 'Global preference', type: 'preference' });
      const details = store.inspectMemory(result.memory_id);
      const mem = details.memory as Record<string, unknown>;
      expect(mem.scope).toBe('global');
    });
  });

  // ── S13: Outcome Feedback ──────────────────────────────────

  describe('feedback (S13)', () => {
    it('updates outcome scores on success', () => {
      const m1 = store.retain({ content: 'Pattern A', type: 'pattern', project_id: 'proj' });
      const m2 = store.retain({ content: 'Pattern B', type: 'pattern', project_id: 'proj' });

      const result = store.feedback({
        memory_ids: [m1.memory_id, m2.memory_id],
        outcome: 'success',
      });

      expect(result.updated_count).toBe(2);
      // EMA: 0.0 + 0.1 * (1.0 - 0.0) = 0.1
      expect(result.new_scores[m1.memory_id]).toBeCloseTo(0.1);
    });

    it('scores converge toward 1.0 with repeated success', () => {
      const m = store.retain({ content: 'Good pattern', type: 'pattern' });

      let lastScore = 0;
      for (let i = 0; i < 20; i++) {
        const r = store.feedback({ memory_ids: [m.memory_id], outcome: 'success' });
        lastScore = r.new_scores[m.memory_id];
      }
      expect(lastScore).toBeGreaterThan(0.8);
    });

    it('scores trend toward 0.0 on failure', () => {
      const m = store.retain({ content: 'Bad pattern', type: 'pattern' });
      // First boost it up
      for (let i = 0; i < 10; i++) {
        store.feedback({ memory_ids: [m.memory_id], outcome: 'success' });
      }
      // Now fail it
      for (let i = 0; i < 10; i++) {
        store.feedback({ memory_ids: [m.memory_id], outcome: 'failure' });
      }
      const final = store.feedback({ memory_ids: [m.memory_id], outcome: 'failure' });
      expect(final.new_scores[m.memory_id]).toBeLessThan(0.5);
    });

    it('does not affect memories not in the list', () => {
      const m1 = store.retain({ content: 'Included', type: 'pattern' });
      const m2 = store.retain({ content: 'Excluded', type: 'pattern' });

      store.feedback({ memory_ids: [m1.memory_id], outcome: 'success' });

      const details = store.inspectMemory(m2.memory_id);
      expect((details.memory as Record<string, unknown>).outcome_score).toBe(0.0);
    });
  });

  // ── S14: Correction ────────────────────────────────────────

  describe('correct (S14)', () => {
    it('creates correction with high importance and archives original', () => {
      const original = store.retain({ content: 'Use MySQL', type: 'decision', project_id: 'proj' });
      const result = store.correct({
        memory_id: original.memory_id,
        new_content: 'Actually use Postgres',
        reason: 'Better for our use case',
      });

      expect(result.correction_id).toBeTruthy();
      expect(result.superseded_id).toBe(original.memory_id);
      expect(result.edge_id).toBeTruthy();

      // Correction has high importance
      const correction = store.inspectMemory(result.correction_id);
      expect((correction.memory as Record<string, unknown>).importance).toBeGreaterThanOrEqual(0.9);
      expect((correction.memory as Record<string, unknown>).type).toBe('correction');

      // Original is superseded
      const orig = store.inspectMemory(original.memory_id);
      expect((orig.memory as Record<string, unknown>).status).toBe('superseded');

      // Edge exists
      expect((correction.edges as unknown[]).length).toBeGreaterThan(0);
    });
  });

  // ── S12: Recall with Budget ────────────────────────────────

  describe('recall (S12)', () => {
    beforeEach(() => {
      // Create 10 memories with various content
      for (let i = 0; i < 10; i++) {
        store.retain({
          content: `Memory about SQLite optimization technique number ${i} for database performance`,
          type: 'pattern',
          project_id: 'my-project',
        });
      }
      // Create a global memory
      store.retain({ content: 'Always use SQLite for local storage', type: 'preference', scope: 'global' });
      // Create a pinned memory
      store.retain({
        content: 'Critical: never use DELETE without WHERE',
        type: 'preference',
        project_id: 'my-project',
        is_pinned: true,
      });
    });

    it('returns memories matching query', () => {
      const results = retrieval.recall({ query: 'SQLite', project_id: 'my-project', token_budget: 4000 });
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects project scope isolation', () => {
      store.retain({ content: 'Other project memory', type: 'pattern', project_id: 'other-project' });
      const results = retrieval.recall({ query: 'memory', project_id: 'my-project', token_budget: 4000 });
      // Should not include other-project's memories
      const otherProjectMemories = results.filter(r => r.project_id === 'other-project');
      expect(otherProjectMemories.length).toBe(0);
    });

    it('bootstrap recall returns pinned memories first', () => {
      const results = retrieval.recall({ project_id: 'my-project', token_budget: 4000 });
      expect(results.length).toBeGreaterThan(0);
      // Pinned should be first
      const pinnedIdx = results.findIndex(r => r.is_pinned);
      if (pinnedIdx >= 0) {
        expect(pinnedIdx).toBe(0);
      }
    });

    it('includes portfolio and global memories in project recall', () => {
      const results = retrieval.recall({ query: 'SQLite', project_id: 'my-project', token_budget: 4000 });
      const globalMemories = results.filter(r => r.scope === 'global');
      expect(globalMemories.length).toBeGreaterThan(0);
    });
  });

  // ── S16: FTS5-Only Mode ────────────────────────────────────

  describe('FTS5-only mode (S16)', () => {
    it('retain works without embedding provider', () => {
      const result = store.retain({ content: 'No embeddings needed', type: 'decision' });
      expect(result.is_new).toBe(true);
    });

    it('recall works via FTS5 matching', () => {
      store.retain({ content: 'SQLite storage decision for local database', type: 'decision' });
      const results = retrieval.recall({ query: 'SQLite storage', token_budget: 4000 });
      expect(results.length).toBeGreaterThan(0);
    });

    it('memoryStatus reports none provider', () => {
      const status = store.memoryStatus();
      expect(status.embedding_provider).toBe('none');
    });

    it('dedup works identically without embeddings', () => {
      const a = store.retain({ content: 'Test content', type: 'pattern' });
      const b = store.retain({ content: 'Test content', type: 'pattern' });
      expect(b.is_new).toBe(false);
      expect(b.memory_id).toBe(a.memory_id);
    });
  });

  // ── Forget and Inspect ─────────────────────────────────────

  describe('forget and inspect', () => {
    it('forget archives a memory', () => {
      const m = store.retain({ content: 'To forget', type: 'decision' });
      const result = store.forget({ memory_id: m.memory_id, reason: 'No longer relevant' });
      expect(result.status).toBe('archived');

      const details = store.inspectMemory(m.memory_id);
      expect((details.memory as Record<string, unknown>).status).toBe('archived');
      expect((details.memory as Record<string, unknown>).forget_reason).toBe('No longer relevant');
    });

    it('inspect returns full provenance', () => {
      const m = store.retain({
        content: 'Inspectable memory',
        type: 'decision',
        session_id: 'session-123',
        agent_role: 'build',
      });

      const details = store.inspectMemory(m.memory_id);
      expect(details.memory).toBeDefined();
      expect(details.versions).toBeDefined();
      expect((details.versions as unknown[]).length).toBeGreaterThan(0);
      expect(details.sources).toBeDefined();
      expect((details.sources as unknown[]).length).toBeGreaterThan(0);
    });
  });

  // ── Configure ──────────────────────────────────────────────

  describe('configureMemory', () => {
    it('sets and returns configuration', () => {
      const config = store.configureMemory({ embedding_provider: 'ollama' });
      expect(config.embedding_provider).toBe('ollama');

      const status = store.memoryStatus();
      expect(status.embedding_provider).toBe('ollama');
    });
  });
});
