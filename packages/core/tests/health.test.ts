// @fctry: #health-assessment
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { Registry, MemoryStore, HealthAssessor, connect } from '../src/index.js';

describe('HealthAssessor', () => {
  let tmpDir: string;
  let dbPath: string;
  let registry: Registry;
  let health: HealthAssessor;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-health-'));
    dbPath = join(tmpDir, 'test.db');
    registry = new Registry(dbPath);
    health = new HealthAssessor(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function backdateProject(name: string, iso: string) {
    const db = connect(dbPath);
    try {
      db.prepare('UPDATE projects SET updated_at = ? WHERE name = ?').run(iso, name);
    } finally {
      db.close();
    }
  }

  // ── S65: Composite tier ───────────────────────────────────────

  it('S65: every non-archived project receives exactly one tier (worst of three)', () => {
    registry.register({
      name: 'alpha', type: 'project', status: 'active',
      description: 'A complete project',
      goals: 'Ship it',
      paths: [join(tmpDir, 'fake-path')],
      fields: { tech_stack: 'TypeScript', patterns: 'monorepo' },
    });
    registry.enrichProject('alpha', { topics: ['a'], entities: ['b'] });
    const r = health.assessProject('alpha', { noCache: true });
    expect(['healthy', 'at_risk', 'stale']).toContain(r.overall);
    expect(r.dimensions.activity).toBeDefined();
    expect(r.dimensions.completeness).toBeDefined();
    expect(r.dimensions.outcomes).toBeDefined();
  });

  it('S65: archived projects return Unknown', () => {
    registry.register({ name: 'gamma', type: 'project', status: 'active', description: 'd', goals: 'g' });
    registry.archiveProject('gamma');
    const r = health.assessProject('gamma', { noCache: true });
    expect(r.overall).toBe('unknown');
    expect(r.reasons.some(s => /archived/i.test(s))).toBe(true);
  });

  it('S65: overall is the worst of the three dimensions', () => {
    registry.register({
      // Missing description → completeness stale
      name: 'delta', type: 'project', status: 'active',
      description: '', goals: 'g',
      paths: [join(tmpDir, 'x')],
      fields: { topics: '["a"]', entities: '["b"]' },
    });
    const r = health.assessProject('delta', { noCache: true });
    expect(r.dimensions.completeness.tier).toBe('stale');
    expect(r.overall).toBe('stale');
  });

  // ── S66: Activity buckets ─────────────────────────────────────

  it('S66: recently-updated project is Healthy on activity', () => {
    registry.register({ name: 'fresh', type: 'project', status: 'active', description: 'd', goals: 'g' });
    const r = health.assessProject('fresh', { noCache: true });
    expect(r.dimensions.activity.tier).toBe('healthy');
    expect(r.dimensions.activity.reasons[0]).toMatch(/day/);
  });

  it('S66: 8-30 days → at_risk with exact age', () => {
    registry.register({ name: 'mid', type: 'project', status: 'active', description: 'd', goals: 'g' });
    const d = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    backdateProject('mid', d);
    health.clearCache();
    const r = health.assessProject('mid', { noCache: true });
    expect(r.dimensions.activity.tier).toBe('at_risk');
    expect(r.dimensions.activity.reasons[0]).toMatch(/no activity in 1[45] days/);
  });

  it('S66: >30 days → stale', () => {
    registry.register({ name: 'old', type: 'project', status: 'active', description: 'd', goals: 'g' });
    const d = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    backdateProject('old', d);
    const r = health.assessProject('old', { noCache: true });
    expect(r.dimensions.activity.tier).toBe('stale');
    expect(r.dimensions.activity.reasons[0]).toMatch(/no activity in 4[45] days/);
  });

  it('S66: memory retain counts as a touch', () => {
    registry.register({ name: 'quiet', type: 'project', status: 'active', description: 'd', goals: 'g' });
    // Backdate the project then retain a fresh memory
    const d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    backdateProject('quiet', d);
    const store = new MemoryStore(dbPath);
    store.retain({ content: 'Touched today', type: 'observation', project_id: 'quiet' });
    health.clearCache();
    const r = health.assessProject('quiet', { noCache: true });
    expect(r.dimensions.activity.tier).toBe('healthy');
  });

  // ── S67: Completeness ─────────────────────────────────────────

  it('S67: missing description moves completeness to Stale with reason', () => {
    registry.register({ name: 'bare', type: 'project', status: 'active', description: '', goals: 'g' });
    const r = health.assessProject('bare', { noCache: true });
    expect(r.dimensions.completeness.tier).toBe('stale');
    expect(r.dimensions.completeness.reasons.join(' ')).toMatch(/description missing/);
  });

  it('S67: missing goals moves completeness to Stale', () => {
    registry.register({ name: 'goalless', type: 'project', status: 'active', description: 'd', goals: '' });
    const r = health.assessProject('goalless', { noCache: true });
    expect(r.dimensions.completeness.tier).toBe('stale');
    expect(r.dimensions.completeness.reasons.join(' ')).toMatch(/no goals/);
  });

  it('S67: non-code project not penalized for missing tech_stack', () => {
    // spec 0.13: non-code work is a project with no tech_stack and area='Personal'.
    registry.register({
      name: 'areax', type: 'project', status: 'active',
      description: 'd', goals: 'g',
      paths: [join(tmpDir, 'areas/areax')],
      area: 'Personal',
    });
    registry.enrichProject('areax', { topics: ['a'], entities: ['b'] });
    const r = health.assessProject('areax', { noCache: true });
    expect(r.dimensions.completeness.tier).toBe('healthy');
    // Specifically: no tech_stack/patterns reasons
    expect(r.dimensions.completeness.reasons.join(' ')).not.toMatch(/tech_stack|patterns/);
  });

  it('S67: missing topics moves completeness to At risk (not Stale)', () => {
    registry.register({
      name: 'nodetopics', type: 'project', status: 'active',
      description: 'd', goals: 'g',
      paths: [join(tmpDir, 'x')],
      fields: { tech_stack: 'TS', patterns: 'x', entities: '["b"]' },
    });
    const r = health.assessProject('nodetopics', { noCache: true });
    expect(r.dimensions.completeness.tier).toBe('at_risk');
    expect(r.dimensions.completeness.reasons.join(' ')).toMatch(/topics/);
  });

  // ── S68: Outcomes ─────────────────────────────────────────────

  it('S68: project with no memories is Healthy on outcomes', () => {
    registry.register({
      name: 'quietouts', type: 'project', status: 'active',
      description: 'd', goals: 'g', paths: [join(tmpDir, 'x')],
      fields: { tech_stack: 'TS', patterns: 'x', topics: '["a"]', entities: '["b"]' },
    });
    const r = health.assessProject('quietouts', { noCache: true });
    expect(r.dimensions.outcomes.tier).toBe('healthy');
    expect(r.dimensions.outcomes.reasons[0]).toMatch(/no feedback/i);
  });

  it('S68: recent negative outcome → At risk', () => {
    registry.register({ name: 'buggy', type: 'project', status: 'active', description: 'd', goals: 'g' });
    const db = connect(dbPath);
    try {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO memories (id, content, type, status, project_id, scope, content_hash, created_at, updated_at, outcome_score)
                  VALUES (?, ?, 'outcome', 'active', ?, 'project', ?, ?, ?, -0.5)`)
        .run('m-buggy-1', 'build failed', 'buggy', 'h1', now, now);
    } finally { db.close(); }
    const r = health.assessProject('buggy', { noCache: true });
    expect(r.dimensions.outcomes.tier).toBe('at_risk');
    expect(r.dimensions.outcomes.reasons.join(' ')).toMatch(/negative/);
  });

  it('S68: high correction ratio → Stale', () => {
    registry.register({ name: 'corrected', type: 'project', status: 'active', description: 'd', goals: 'g' });
    const db = connect(dbPath);
    try {
      const now = new Date().toISOString();
      const ins = db.prepare(`INSERT INTO memories (id, content, type, status, project_id, scope, content_hash, created_at, updated_at)
                                VALUES (?, ?, ?, 'active', ?, 'project', ?, ?, ?)`);
      ins.run('c1', 'd', 'decision', 'corrected', 'h-c1', now, now);
      ins.run('c2', 'correction a', 'correction', 'corrected', 'h-c2', now, now);
      ins.run('c3', 'correction b', 'correction', 'corrected', 'h-c3', now, now);
      ins.run('c4', 'correction c', 'correction', 'corrected', 'h-c4', now, now);
    } finally { db.close(); }
    const r = health.assessProject('corrected', { noCache: true });
    expect(r.dimensions.outcomes.tier).toBe('stale');
  });

  // ── Caching ───────────────────────────────────────────────────

  it('assessments are cached within the TTL window', () => {
    registry.register({ name: 'cached', type: 'project', status: 'active', description: 'd', goals: 'g' });
    const r1 = health.assessProject('cached');
    const r2 = health.assessProject('cached');
    expect(r2.computed_at).toBe(r1.computed_at);
  });

  // ── Portfolio ─────────────────────────────────────────────────

  it('portfolio response excludes archived projects, includes summary, sorts worst-to-best', () => {
    registry.register({ name: 'ok', type: 'project', status: 'active', description: 'd', goals: 'g',
      paths: [join(tmpDir, 'x')],
      fields: { tech_stack: 'TS', patterns: 'x', topics: '["a"]', entities: '["b"]' } });
    registry.register({ name: 'bad', type: 'project', status: 'active', description: '', goals: 'g' });
    registry.register({ name: 'archivedx', type: 'project', status: 'active', description: 'd', goals: 'g' });
    registry.archiveProject('archivedx');

    const p = health.assessPortfolio({ noCache: true });
    const names = p.projects.map(x => x.name);
    expect(names).toContain('ok');
    expect(names).toContain('bad');
    expect(names).not.toContain('archivedx');
    // Worst-first
    expect(p.projects[0].overall).toBe('stale');
    expect(typeof p.summary.healthy).toBe('number');
    expect(typeof p.summary.stale).toBe('number');
  });

  it('throws NotFoundError with suggestion for unknown project', () => {
    registry.register({ name: 'alpha', type: 'project', status: 'active', description: 'd', goals: 'g' });
    expect(() => health.assessProject('alphaa', { noCache: true })).toThrow(/alpha/);
  });
});
