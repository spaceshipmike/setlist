import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import {
  Registry, MemoryStore, MemoryRetrieval, CrossQuery, MemoryReflection,
  initDb, connect, SCHEMA_VERSION,
  scanLocations, applyProposals,
  discoverPortsInPath,
} from '../src/index.js';

describe('Schema Compatibility (S02)', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-compat-'));
    dbPath = join(tmpDir, 'test.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('TypeScript-created DB has current schema version', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    const meta = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as { value: string };
    expect(meta.value).toBe('14');
    db.close();
  });

  it('can read and write all entity types in a round-trip', () => {
    const registry = new Registry(dbPath);
    const store = new MemoryStore(dbPath);

    // Register project
    registry.register({
      name: 'compat-test',
      type: 'project',
      status: 'active',
      description: 'Compat test project',
      goals: 'Test compatibility',
      display_name: 'Compat Test',
      paths: ['/tmp/compat'],
    });

    // Add fields
    registry.updateFields('compat-test', { tech_stack: ['typescript'] }, 'fctry');

    // Claim port
    registry.claimPort('compat-test', 'dev server', 3000);

    // Register capabilities
    registry.registerCapabilities('compat-test', [
      { name: 'search', capability_type: 'mcp-tool', description: 'Search' },
    ]);

    // Retain memory
    store.retain({
      content: 'Test decision for compat',
      type: 'decision',
      project_id: 'compat-test',
      tags: ['compat'],
    });

    // Queue task
    registry.queueTask({
      description: 'Test task',
      project_name: 'compat-test',
      schedule: 'now',
    });

    // Read everything back
    const project = registry.getProject('compat-test', 'full')!;
    expect(project.name).toBe('compat-test');
    expect(project.paths).toEqual(['/tmp/compat']);

    const ports = registry.listProjectPorts('compat-test');
    expect(ports.length).toBe(1);

    const caps = registry.queryCapabilities({ project_name: 'compat-test' });
    expect(caps.length).toBe(1);

    const retrieval = new MemoryRetrieval(dbPath);
    const memories = retrieval.recall({ query: 'compat', project_id: 'compat-test', token_budget: 4000 });
    expect(memories.length).toBeGreaterThan(0);

    const tasks = registry.listTasks({ project_name: 'compat-test' });
    expect(tasks.length).toBe(1);
  });

  it('schema upgrade from v0 to current adds missing columns', () => {
    // Create a minimal v0 DB (just projects table without display_name)
    const db = connect(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        goals TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO schema_meta (key, value) VALUES ('schema_version', '0');
      INSERT INTO projects (name, type, status, description) VALUES ('old-project', 'project', 'active', 'Old');
    `);
    db.close();

    // Opening with initDb should upgrade
    initDb(dbPath);
    const db2 = connect(dbPath);
    const meta = db2.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as { value: string };
    expect(meta.value).toBe('14');

    // display_name column should exist now
    const row = db2.prepare('SELECT display_name FROM projects WHERE name = ?').get('old-project') as { display_name: string };
    expect(row.display_name).toBe('');
    db2.close();
  });
});

describe('Library Import (S22)', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-lib-'));
    dbPath = join(tmpDir, 'test.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Registry is importable and functional', () => {
    const registry = new Registry(dbPath);
    registry.register({ name: 'import-test', type: 'project', status: 'active' });
    const projects = registry.listProjects({ depth: 'summary' });
    expect(projects.length).toBe(1);
  });

  it('MemoryStore is importable and functional', () => {
    const store = new MemoryStore(dbPath);
    const result = store.retain({ content: 'Import test', type: 'decision' });
    expect(result.is_new).toBe(true);
  });

  it('MemoryRetrieval is importable and functional', () => {
    const store = new MemoryStore(dbPath);
    store.retain({ content: 'Retrievable memory', type: 'decision' });
    const retrieval = new MemoryRetrieval(dbPath);
    const results = retrieval.recall({ query: 'Retrievable', token_budget: 4000 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('CrossQuery is importable and functional', () => {
    const registry = new Registry(dbPath);
    registry.register({ name: 'cq-test', type: 'project', status: 'active', description: 'Cross query test' });
    const cq = new CrossQuery(dbPath);
    const result = cq.query({ query: 'cross', scope: 'registry' });
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('MemoryReflection is importable and functional', () => {
    const store = new MemoryStore(dbPath);
    store.retain({ content: 'Reflectable', type: 'pattern' });
    const reflection = new MemoryReflection(dbPath);
    const result = reflection.reflect();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('all exports are available from @setlist/core', () => {
    // Verify key exports exist
    expect(Registry).toBeDefined();
    expect(MemoryStore).toBeDefined();
    expect(MemoryRetrieval).toBeDefined();
    expect(CrossQuery).toBeDefined();
    expect(MemoryReflection).toBeDefined();
    expect(initDb).toBeDefined();
    expect(connect).toBeDefined();
    expect(SCHEMA_VERSION).toBe(14);
    expect(scanLocations).toBeDefined();
    expect(applyProposals).toBeDefined();
    expect(discoverPortsInPath).toBeDefined();
  });
});
