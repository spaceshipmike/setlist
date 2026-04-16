import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb, connect, SCHEMA_VERSION, getTemplateFields } from '../src/index.js';

describe('Schema Initialization (S01)', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-test-'));
    dbPath = join(tmpDir, 'test-registry.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates the database with schema v8', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const meta = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as { value: string };
      expect(meta.value).toBe(String(SCHEMA_VERSION));
      expect(SCHEMA_VERSION).toBe(11);
    } finally {
      db.close();
    }
  });

  it('enables WAL mode', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const mode = db.pragma('journal_mode', { simple: true }) as string;
      expect(mode).toBe('wal');
    } finally {
      db.close();
    }
  });

  it('creates all 18 tables', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { name: string }[];
      const tableNames = tables.map(t => t.name);

      // 17 regular tables + 1 FTS content table + FTS auxiliary tables
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('project_paths');
      expect(tableNames).toContain('project_fields');
      expect(tableNames).toContain('field_catalog');
      expect(tableNames).toContain('templates');
      expect(tableNames).toContain('template_fields');
      expect(tableNames).toContain('schema_meta');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('project_ports');
      expect(tableNames).toContain('project_capabilities');
      expect(tableNames).toContain('memories');
      expect(tableNames).toContain('memory_versions');
      expect(tableNames).toContain('memory_edges');
      expect(tableNames).toContain('memory_sources');
      expect(tableNames).toContain('summary_blocks');
      expect(tableNames).toContain('enrichment_log');
      expect(tableNames).toContain('recall_audit');
    } finally {
      db.close();
    }
  });

  it('creates FTS5 virtual table', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      // FTS5 virtual table should exist
      const vtables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'memory_fts'"
      ).all();
      expect(vtables.length).toBe(1);

      // Should be queryable without error
      const result = db.prepare("SELECT * FROM memory_fts WHERE memory_fts MATCH 'test'").all();
      expect(result).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('enables foreign keys', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const fk = db.pragma('foreign_keys', { simple: true }) as number;
      expect(fk).toBe(1);
    } finally {
      db.close();
    }
  });

  it('seeds field catalog with 13 entries', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const count = db.prepare('SELECT COUNT(*) as count FROM field_catalog').get() as { count: number };
      expect(count.count).toBe(13);

      // Verify key fields exist
      const techStack = db.prepare("SELECT * FROM field_catalog WHERE name = 'tech_stack'").get() as Record<string, unknown>;
      expect(techStack).toBeDefined();
      expect(techStack.field_type).toBe('list');
      expect(techStack.category).toBe('technical');
      expect(techStack.is_list).toBe(1);
    } finally {
      db.close();
    }
  });

  it('seeds 3 templates', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const templates = db.prepare('SELECT name FROM templates ORDER BY name').all() as { name: string }[];
      const names = templates.map(t => t.name);
      expect(names).toContain('code_project');
      expect(names).toContain('non_code_project');
      expect(names).toContain('area_of_focus');
    } finally {
      db.close();
    }
  });

  it('getTemplateFields returns correct fields for code_project', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const fields = getTemplateFields(db, 'project');
      expect(fields.has('tech_stack')).toBe(true);
      expect(fields.has('patterns')).toBe(true);
      expect(fields.has('mcp_servers')).toBe(true);
      expect(fields.has('urls')).toBe(true);
      expect(fields.has('keywords')).toBe(true);
      // Should not include context fields
      expect(fields.has('stakeholders')).toBe(false);
      expect(fields.has('timeline')).toBe(false);
    } finally {
      db.close();
    }
  });

  it('is idempotent — calling initDb twice does not error', () => {
    initDb(dbPath);
    initDb(dbPath); // Should not throw
    const db = connect(dbPath);
    try {
      const meta = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as { value: string };
      expect(meta.value).toBe(String(SCHEMA_VERSION));
    } finally {
      db.close();
    }
  });

  it('creates expected indexes', () => {
    initDb(dbPath);
    const db = connect(dbPath);
    try {
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      ).all() as { name: string }[];
      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_projects_type');
      expect(indexNames).toContain('idx_projects_status');
      expect(indexNames).toContain('idx_projects_type_status');
      expect(indexNames).toContain('idx_project_fields_project_id');
      expect(indexNames).toContain('idx_memories_hash');
      expect(indexNames).toContain('idx_memories_pinned');
      expect(indexNames).toContain('idx_edges_source');
      expect(indexNames).toContain('idx_edges_target');
      expect(indexNames.length).toBeGreaterThanOrEqual(20);
    } finally {
      db.close();
    }
  });
});
