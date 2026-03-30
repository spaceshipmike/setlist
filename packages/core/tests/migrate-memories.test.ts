import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryStore } from '../src/index.js';
import { scanMemories, applyMemoryMigration } from '../src/migrate-memories.js';

// Note: scanMemories() reads from hardcoded paths (~/.claude/projects, ~/.fctry/memory.md).
// These tests focus on applyMemoryMigration with pre-built proposals and the internal parsing logic.

describe('Migrate Memories', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-mm-'));
    dbPath = join(tmpDir, 'test.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('migrates proposals into memory store', () => {
    const proposals = [
      {
        content: 'User prefers kebab-case file names',
        type: 'preference',
        project_id: null,
        scope: 'global',
        source: 'cc-memory:test/user.md',
        tags: ['migrated', 'cc-auto-memory', 'user'],
      },
      {
        content: 'Decided to use SQLite for the registry',
        type: 'decision',
        project_id: 'project-registry-service',
        scope: 'project',
        source: 'cc-memory:test/project.md',
        tags: ['migrated', 'cc-auto-memory', 'project'],
      },
    ];

    const result = applyMemoryMigration(proposals, dbPath);
    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(0);

    // Verify memories exist
    const store = new MemoryStore(dbPath);
    const status = store.memoryStatus();
    expect(status.total).toBe(2);
  });

  it('deduplicates on re-migration', () => {
    const proposals = [
      {
        content: 'Same content twice',
        type: 'preference',
        project_id: null,
        scope: 'global',
        source: 'cc-memory:test/pref.md',
        tags: ['migrated'],
      },
    ];

    const first = applyMemoryMigration(proposals, dbPath);
    expect(first.migrated).toBe(1);

    const second = applyMemoryMigration(proposals, dbPath);
    expect(second.migrated).toBe(0);
    expect(second.skipped).toBe(1); // Dedup hit
  });

  it('handles mixed valid and invalid proposals', () => {
    const proposals = [
      {
        content: 'Valid memory',
        type: 'decision',
        project_id: null,
        scope: 'global',
        source: 'test',
        tags: [],
      },
      {
        content: 'Invalid type',
        type: 'not_a_real_type',
        project_id: null,
        scope: 'global',
        source: 'test',
        tags: [],
      },
    ];

    const result = applyMemoryMigration(proposals, dbPath);
    expect(result.migrated).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('maps CC memory types correctly', () => {
    const proposals = [
      { content: 'Feedback content', type: 'preference', project_id: 'proj', scope: 'project', source: 'cc', tags: ['feedback'] },
      { content: 'Project note', type: 'decision', project_id: 'proj', scope: 'project', source: 'cc', tags: ['project'] },
      { content: 'Reference link', type: 'dependency', project_id: 'proj', scope: 'project', source: 'cc', tags: ['reference'] },
    ];

    const result = applyMemoryMigration(proposals, dbPath);
    expect(result.migrated).toBe(3);

    const store = new MemoryStore(dbPath);
    const status = store.memoryStatus() as Record<string, unknown>;
    const byType = status.counts_by_type as Record<string, number>;
    expect(byType.preference).toBe(1);
    expect(byType.decision).toBe(1);
    expect(byType.dependency).toBe(1);
  });

  it('retains memories with migration agent role', () => {
    const proposals = [
      { content: 'Check agent role', type: 'pattern', project_id: null, scope: 'global', source: 'test', tags: [] },
    ];

    const result = applyMemoryMigration(proposals, dbPath);
    expect(result.migrated).toBe(1);

    // Verify the memory exists in the store
    const store = new MemoryStore(dbPath);
    const status = store.memoryStatus();
    expect(status.total).toBe(1);
  });
});
