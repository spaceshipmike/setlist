import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryStore, MemoryReflection, connect } from '../src/index.js';

describe('Memory Reflection (S15)', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: MemoryStore;
  let reflection: MemoryReflection;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-ref-'));
    dbPath = join(tmpDir, 'test.db');
    store = new MemoryStore(dbPath);
    reflection = new MemoryReflection(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('archives stale memories via triple gate', () => {
    // Create a memory that passes all three gates
    const m = store.retain({
      content: 'Very old low-quality memory',
      type: 'pattern',
      importance: 0.1, // < 0.3 threshold
    });

    // Manually backdate it to > 90 days ago
    const db = connect(dbPath);
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE memories SET updated_at = ?, created_at = ? WHERE id = ?').run(oldDate, oldDate, m.memory_id);
    db.close();

    const result = reflection.reflect();
    expect(result.memories_archived).toBe(1);

    // Verify it's actually archived
    const details = store.inspectMemory(m.memory_id);
    expect((details.memory as Record<string, unknown>).status).toBe('archived');
  });

  it('protects frequently-accessed memories from archival', () => {
    // Create a low-quality but frequently reinforced memory
    const m = store.retain({
      content: 'Frequently accessed pattern',
      type: 'pattern',
      importance: 0.1,
    });
    // Reinforce it multiple times to get reinforcement_count >= 2
    store.retain({ content: 'Frequently accessed pattern', type: 'pattern' });
    store.retain({ content: 'Frequently accessed pattern', type: 'pattern' });

    // Backdate
    const db = connect(dbPath);
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE memories SET updated_at = ?, created_at = ? WHERE id = ?').run(oldDate, oldDate, m.memory_id);
    db.close();

    const result = reflection.reflect();
    // Should NOT be archived because reinforcement_count >= 2
    expect(result.memories_archived).toBe(0);
  });

  it('never archives corrections', () => {
    const orig = store.retain({ content: 'Original', type: 'decision', importance: 0.1 });
    const correction = store.correct({
      memory_id: orig.memory_id,
      new_content: 'Corrected',
      reason: 'Wrong',
    });

    // Backdate the correction
    const db = connect(dbPath);
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE memories SET updated_at = ?, importance = 0.1 WHERE id = ?').run(oldDate, correction.correction_id);
    db.close();

    reflection.reflect();

    // Correction should still be active
    const details = store.inspectMemory(correction.correction_id);
    expect((details.memory as Record<string, unknown>).status).toBe('active');
  });

  it('creates summary blocks for projects', () => {
    store.retain({ content: 'Project decision A', type: 'decision', project_id: 'test-project' });
    store.retain({ content: 'Project pattern B', type: 'pattern', project_id: 'test-project' });

    const result = reflection.reflect();
    expect(result.summary_blocks_rewritten).toBeGreaterThan(0);

    // Verify summary block exists
    const db = connect(dbPath);
    const block = db.prepare("SELECT * FROM summary_blocks WHERE scope = 'project'").get();
    expect(block).toBeDefined();
    db.close();
  });

  it('logs reflection in enrichment_log', () => {
    store.retain({ content: 'Test memory', type: 'decision' });
    reflection.reflect();

    const db = connect(dbPath);
    const logs = db.prepare("SELECT * FROM enrichment_log WHERE engine_kind = 'reflection-cycle'").all();
    expect(logs.length).toBeGreaterThan(0);
    db.close();
  });

  it('returns timing information', () => {
    const result = reflection.reflect();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(typeof result.memories_merged).toBe('number');
    expect(typeof result.edges_created).toBe('number');
    expect(typeof result.memories_archived).toBe('number');
  });
});
