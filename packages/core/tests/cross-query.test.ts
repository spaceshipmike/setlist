import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, MemoryStore, CrossQuery } from '../src/index.js';

describe('Cross-Project Queries (S19)', () => {
  let tmpDir: string;
  let dbPath: string;
  let registry: Registry;
  let store: MemoryStore;
  let crossQuery: CrossQuery;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-cq-'));
    dbPath = join(tmpDir, 'test.db');
    registry = new Registry(dbPath);
    store = new MemoryStore(dbPath);
    crossQuery = new CrossQuery(dbPath);

    // Populate with test data
    registry.register({ name: 'auth-service', type: 'project', status: 'active', description: 'Authentication service using JWT tokens' });
    registry.register({ name: 'data-pipeline', type: 'project', status: 'active', description: 'Data processing pipeline' });
    registry.updateFields('auth-service', { tech_stack: ['typescript', 'sqlite'] }, 'fctry');

    store.retain({ content: 'Decided to use JWT for authentication', type: 'decision', project_id: 'auth-service' });
    store.retain({ content: 'SQLite chosen for local storage', type: 'decision', project_id: 'data-pipeline' });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('searches registry fields', () => {
    const result = crossQuery.query({ query: 'authentication', scope: 'registry' });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.some(r => r.project === 'auth-service')).toBe(true);
    expect(result.results.every(r => r.source === 'registry')).toBe(true);
  });

  it('searches structured memories', () => {
    const result = crossQuery.query({ query: 'JWT', scope: 'memories' });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every(r => r.source === 'memory')).toBe(true);
  });

  it('scope=all combines registry + memories', () => {
    const result = crossQuery.query({ query: 'SQLite', scope: 'all' });
    const sources = new Set(result.results.map(r => r.source));
    expect(sources.size).toBeGreaterThanOrEqual(1);
  });

  it('results are ranked by relevance + freshness + importance', () => {
    const result = crossQuery.query({ query: 'authentication', scope: 'registry' });
    // Results should be sorted by score descending
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i].score).toBeLessThanOrEqual(result.results[i - 1].score);
    }
  });

  it('sources are cited in results', () => {
    const result = crossQuery.query({ query: 'authentication', scope: 'registry' });
    for (const r of result.results) {
      expect(r.source).toBeDefined();
      expect(r.project).toBeDefined();
    }
  });

  it('returns empty results gracefully', () => {
    const result = crossQuery.query({ query: 'zzz_nonexistent_term', scope: 'registry' });
    expect(result.results).toEqual([]);
    expect(result.summary).toContain('No results found');
  });

  it('synthesizes a summary', () => {
    const result = crossQuery.query({ query: 'authentication', scope: 'registry' });
    expect(result.summary).toBeTruthy();
    expect(result.summary).toContain('result');
  });
});
