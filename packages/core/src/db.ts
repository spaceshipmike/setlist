import Database from 'better-sqlite3';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { seedAreas as seedAreasFromModule, SEED_AREAS } from './areas.js';
import { seedProjectTypes } from './project-types.js';
import { seedBuiltinPrimitives, seedBuiltinRecipes } from './recipes/store.js';

export const SCHEMA_VERSION = 15;

/**
 * Legacy alias kept for any callers that still expect the constant name.
 * Spec 0.26 retired the "canonical seven" — these names are now seed defaults
 * for a fresh database, not system-owned. Areas are user-managed via Settings.
 */
export const CANONICAL_AREAS = SEED_AREAS;

const DEFAULT_DB_DIR = join(homedir(), '.local', 'share', 'project-registry');
const DEFAULT_DB_NAME = 'registry.db';

export function getDbPath(): string {
  return join(DEFAULT_DB_DIR, DEFAULT_DB_NAME);
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS project_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_directory TEXT NOT NULL,
    git_init INTEGER NOT NULL,
    template_directory TEXT,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('project')),
    status TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    goals TEXT NOT NULL DEFAULT '',
    area_id INTEGER REFERENCES areas(id),
    parent_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    project_type_id INTEGER REFERENCES project_types(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    added_by TEXT NOT NULL DEFAULT 'system',
    UNIQUE(project_id, path)
);

CREATE TABLE IF NOT EXISTS project_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_value TEXT NOT NULL,
    producer TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, field_name)
);

CREATE TABLE IF NOT EXISTS field_catalog (
    name TEXT PRIMARY KEY,
    field_type TEXT NOT NULL DEFAULT 'string',
    category TEXT NOT NULL DEFAULT 'custom',
    description TEXT NOT NULL DEFAULT '',
    is_list INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS template_fields (
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    PRIMARY KEY (template_id, field_name)
);

CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT,
    description TEXT NOT NULL,
    schedule TEXT NOT NULL CHECK (schedule IN ('now', 'tonight', 'weekly')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    session_reference TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS project_ports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    port INTEGER NOT NULL UNIQUE,
    service_label TEXT NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'tcp' CHECK (protocol IN ('tcp', 'udp')),
    claimed_by TEXT NOT NULL DEFAULT 'system',
    claimed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_capabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capability_type TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    inputs TEXT NOT NULL DEFAULT '',
    outputs TEXT NOT NULL DEFAULT '',
    producer TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    requires_auth INTEGER,
    invocation_model TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    content_l0 TEXT,
    content_l1 TEXT,
    type TEXT NOT NULL CHECK (type IN ('decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'learning', 'context', 'procedural', 'observation')),
    importance REAL DEFAULT 0.5,
    confidence REAL DEFAULT 0.5,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consolidating', 'archived', 'superseded')),
    project_id TEXT,
    scope TEXT DEFAULT 'project' CHECK (scope IN ('project', 'area', 'portfolio', 'global')),
    agent_role TEXT,
    session_id TEXT,
    tags TEXT,
    content_hash TEXT NOT NULL,
    embedding BLOB,
    embedding_model TEXT,
    embedding_new BLOB,
    embedding_model_new TEXT,
    reinforcement_count INTEGER DEFAULT 1,
    outcome_score REAL DEFAULT 0.0,
    is_static INTEGER DEFAULT 0,
    is_inference INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    belief TEXT CHECK (belief IN ('fact', 'opinion', 'hypothesis')),
    extraction_confidence REAL,
    valid_from TEXT,
    valid_until TEXT,
    entities TEXT,
    parent_version_id TEXT REFERENCES memories(id),
    is_current INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_accessed TEXT,
    forget_after TEXT,
    forget_reason TEXT,
    UNIQUE(content_hash, project_id, scope)
);

CREATE TABLE IF NOT EXISTS memory_versions (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL REFERENCES memories(id),
    previous_content TEXT,
    author TEXT NOT NULL CHECK (author IN ('agent', 'user', 'system')),
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'corrected', 'archived', 'superseded')),
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES memories(id),
    target_id TEXT NOT NULL REFERENCES memories(id),
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('updates', 'extends', 'derives', 'contradicts', 'caused_by', 'related_to')),
    weight REAL DEFAULT 1.0,
    confidence REAL DEFAULT 0.5,
    observation_count INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_sources (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL REFERENCES memories(id),
    project_id TEXT,
    session_id TEXT,
    agent_role TEXT,
    context_snippet TEXT,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summary_blocks (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    char_limit INTEGER DEFAULT 2000,
    tier TEXT DEFAULT 'dynamic' CHECK (tier IN ('static', 'dynamic')),
    updated_at TEXT NOT NULL,
    UNIQUE(scope, label)
);

CREATE TABLE IF NOT EXISTS enrichment_log (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL REFERENCES memories(id),
    engine_kind TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recall_audit (
    id TEXT PRIMARY KEY,
    query TEXT,
    mode TEXT CHECK (mode IN ('search', 'bootstrap', 'profile')),
    budget_tokens INTEGER,
    scope TEXT,
    project_id TEXT,
    memory_ids_returned TEXT,
    scores TEXT,
    timestamp TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    memory_id,
    content,
    content_l0,
    content_l1
);

CREATE TABLE IF NOT EXISTS project_digests (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    digest_kind TEXT NOT NULL DEFAULT 'essence',
    digest_text TEXT NOT NULL,
    spec_version TEXT NOT NULL,
    producer TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    token_count INTEGER,
    named_terms TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (project_id, digest_kind)
);

-- v14 (spec 0.28): user-composable bootstrap primitives.
-- bootstrap_primitives is the registry of primitives the recipe runner knows
-- how to execute. Built-ins (is_builtin=1) are setlist-shipped and read-only
-- in shape; custom rows are user-authored. The four built-ins are seeded by
-- seedBuiltinPrimitives() (in recipes/store.ts).
CREATE TABLE IF NOT EXISTS bootstrap_primitives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    shape TEXT NOT NULL CHECK (shape IN ('filesystem-op', 'shell-command', 'mcp-tool')),
    is_builtin INTEGER NOT NULL DEFAULT 0,
    builtin_key TEXT UNIQUE,
    definition_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- v14 (spec 0.28): per-type recipe steps. Each row is one ordered invocation
-- of a primitive, with bound parameter values stored as a JSON object.
-- The register-in-registry trailer is structural and is NOT stored here.
CREATE TABLE IF NOT EXISTS project_type_recipe_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_type_id INTEGER NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    primitive_id INTEGER NOT NULL REFERENCES bootstrap_primitives(id) ON DELETE RESTRICT,
    params_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(project_type_id, position)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type_status ON projects(type, status);
-- v11 area_id + parent_project_id indexes are created after ensureColumns runs
-- in case the projects table was created by an older schema (no area columns).
CREATE INDEX IF NOT EXISTS idx_project_fields_project_id ON project_fields(project_id);
CREATE INDEX IF NOT EXISTS idx_project_fields_field_name ON project_fields(field_name);
CREATE INDEX IF NOT EXISTS idx_project_paths_project_id ON project_paths(project_id);
CREATE INDEX IF NOT EXISTS idx_project_paths_path ON project_paths(path);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_name ON tasks(project_name);
CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON tasks(schedule);
CREATE INDEX IF NOT EXISTS idx_project_ports_project_id ON project_ports(project_id);
CREATE INDEX IF NOT EXISTS idx_project_ports_port ON project_ports(port);
CREATE INDEX IF NOT EXISTS idx_project_capabilities_project_id ON project_capabilities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_capabilities_type ON project_capabilities(capability_type);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, status);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type, status);
CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);
CREATE INDEX IF NOT EXISTS idx_versions_memory ON memory_versions(memory_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON memory_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON memory_edges(relationship_type);
CREATE INDEX IF NOT EXISTS idx_sources_memory ON memory_sources(memory_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_memory ON enrichment_log(memory_id, engine_kind);
CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned, status);
CREATE INDEX IF NOT EXISTS idx_project_digests_project ON project_digests(project_id);
CREATE INDEX IF NOT EXISTS idx_bootstrap_primitives_builtin ON bootstrap_primitives(is_builtin, builtin_key);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_type ON project_type_recipe_steps(project_type_id, position);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_primitive ON project_type_recipe_steps(primitive_id);
-- v13 project_type_id index is created after ensureColumns runs in case the
-- projects table was created by an older schema (no project_type_id column).
`;

// FTS5 triggers for keeping the index in sync
const FTS_TRIGGERS_SQL = `
CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memory_fts(memory_id, content, content_l0, content_l1)
    VALUES (new.id, new.content, new.content_l0, new.content_l1);
END;

CREATE TRIGGER IF NOT EXISTS memory_fts_delete BEFORE DELETE ON memories BEGIN
    DELETE FROM memory_fts WHERE memory_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE OF content, content_l0, content_l1 ON memories BEGIN
    DELETE FROM memory_fts WHERE memory_id = old.id;
    INSERT INTO memory_fts(memory_id, content, content_l0, content_l1)
    VALUES (new.id, new.content, new.content_l0, new.content_l1);
END;
`;

// Default field catalog entries
const FIELD_CATALOG_SEED = [
  ['tech_stack', 'list', 'technical', 'Technology stack', 1],
  ['patterns', 'list', 'technical', 'Architectural patterns', 1],
  ['keywords', 'list', 'technical', 'Keywords for search', 1],
  ['ide', 'string', 'tooling', 'IDE or editor', 0],
  ['terminal_profile', 'string', 'tooling', 'Terminal profile name', 0],
  ['mcp_servers', 'list', 'tooling', 'MCP server configurations', 1],
  ['urls', 'list', 'tooling', 'Associated URLs', 1],
  ['stakeholders', 'text', 'context', 'Key stakeholders', 0],
  ['timeline', 'text', 'context', 'Timeline or milestones', 0],
  ['domain', 'text', 'context', 'Domain context', 0],
  ['short_description', 'string', 'identity', 'Short description', 0],
  ['medium_description', 'text', 'identity', 'Medium description', 0],
  ['readme_description', 'text', 'identity', 'README description', 0],
] as const;

// Template definitions
const TEMPLATE_SEED: Record<string, { description: string; fields: string[] }> = {
  code_project: {
    description: 'Template for code projects with technical fields',
    fields: ['tech_stack', 'patterns', 'mcp_servers', 'urls', 'keywords', 'short_description', 'medium_description', 'readme_description'],
  },
  non_code_project: {
    description: 'Template for non-code projects with context fields',
    fields: ['stakeholders', 'timeline', 'domain', 'keywords', 'short_description', 'medium_description'],
  },
  area_of_focus: {
    description: 'Template for areas of focus',
    fields: ['keywords', 'short_description', 'medium_description'],
  },
};

function createFtsTriggers(db: Database.Database): void {
  // Split on END; boundaries to get individual trigger statements
  const triggers = FTS_TRIGGERS_SQL.split(/END;/i)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ' END;');

  for (const trigger of triggers) {
    try {
      db.exec(trigger);
    } catch {
      // Trigger may already exist
    }
  }
}

/**
 * Idempotent area seed. Spec 0.26: seed defaults only on a fresh row;
 * never updates existing entries (the user owns areas after init).
 *
 * Local wrapper kept for migration code that references it by this name;
 * delegates to `seedAreas` in `./areas.ts`.
 */
function seedAreas(db: Database.Database): void {
  seedAreasFromModule(db);
}

function seedFieldCatalog(db: Database.Database): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO field_catalog (name, field_type, category, description, is_list) VALUES (?, ?, ?, ?, ?)`
  );
  for (const entry of FIELD_CATALOG_SEED) {
    stmt.run(...entry);
  }
}

function seedTemplates(db: Database.Database): void {
  for (const [name, config] of Object.entries(TEMPLATE_SEED)) {
    const existing = db.prepare('SELECT id FROM templates WHERE name = ?').get(name) as { id: number } | undefined;
    let templateId: number;
    if (existing) {
      templateId = existing.id;
    } else {
      const result = db.prepare('INSERT INTO templates (name, description) VALUES (?, ?)').run(name, config.description);
      templateId = Number(result.lastInsertRowid);
    }
    const insertField = db.prepare('INSERT OR IGNORE INTO template_fields (template_id, field_name) VALUES (?, ?)');
    for (const field of config.fields) {
      insertField.run(templateId, field);
    }
  }
}

function ensureColumns(db: Database.Database): void {
  // Guard against tables created by an older version (e.g. Python registry)
  // where CREATE TABLE IF NOT EXISTS was a no-op on the existing table.
  const capCols = db.prepare("PRAGMA table_info(project_capabilities)").all() as { name: string }[];
  const capColNames = new Set(capCols.map(c => c.name));
  if (!capColNames.has('requires_auth')) {
    db.exec(`ALTER TABLE project_capabilities ADD COLUMN requires_auth INTEGER`);
  }
  if (!capColNames.has('invocation_model')) {
    db.exec(`ALTER TABLE project_capabilities ADD COLUMN invocation_model TEXT NOT NULL DEFAULT ''`);
  }
  if (!capColNames.has('audience')) {
    db.exec(`ALTER TABLE project_capabilities ADD COLUMN audience TEXT NOT NULL DEFAULT ''`);
  }

  // Ensure profile columns on projects table
  const projCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  const projColNames = new Set(projCols.map(c => c.name));
  if (!projColNames.has('topics')) {
    db.exec(`ALTER TABLE projects ADD COLUMN topics TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!projColNames.has('entities')) {
    db.exec(`ALTER TABLE projects ADD COLUMN entities TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!projColNames.has('concerns')) {
    db.exec(`ALTER TABLE projects ADD COLUMN concerns TEXT NOT NULL DEFAULT '[]'`);
  }
  // v11: structural area + parent columns
  if (!projColNames.has('area_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN area_id INTEGER REFERENCES areas(id)`);
  }
  if (!projColNames.has('parent_project_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN parent_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`);
  }
  // v13: project_type_id column. Backfill happens in the v12→v13 migration;
  // this guard handles fresh-install edge cases where the table was created
  // by SCHEMA_SQL (which already includes the column) and where it wasn't.
  if (!projColNames.has('project_type_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN project_type_id INTEGER REFERENCES project_types(id)`);
  }
  // Indexes that depend on v11/v13 columns must be created after the columns exist
  // (SCHEMA_SQL can't assume the columns are present when upgrading from v0).
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_area_id ON projects(area_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id ON projects(parent_project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_project_type_id ON projects(project_type_id)`);

  // v15: named_terms on project_digests for hybrid retrieval. Stores
  // frontmatter-extracted phrases (tech-stack/patterns/goals) as a JSON
  // array so canary names buried in long lists survive even when the
  // digest summary compresses them away. See packages/core/src/named-terms.ts.
  const digestCols = db.prepare("PRAGMA table_info(project_digests)").all() as { name: string }[];
  if (!digestCols.some(c => c.name === 'named_terms')) {
    db.exec(`ALTER TABLE project_digests ADD COLUMN named_terms TEXT NOT NULL DEFAULT '[]'`);
  }
}

function upgradeSchema(db: Database.Database): void {
  const meta = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  const currentVersion = meta ? parseInt(meta.value, 10) : 0;

  // Back up the database before any schema upgrade so a failed migration is
  // recoverable. The backup is named with the current (pre-upgrade) schema
  // version so each upgrade produces a distinct snapshot.
  if (currentVersion < SCHEMA_VERSION && currentVersion > 0) {
    const dbPath = db.name;
    if (dbPath && dbPath !== ':memory:') {
      const backupPath = `${dbPath}.v${currentVersion}.bak`;
      if (!existsSync(backupPath)) {
        try { copyFileSync(dbPath, backupPath); } catch { /* best-effort */ }
      }
    }
  }

  // Always ensure columns exist, even if schema version matches.
  // CREATE TABLE IF NOT EXISTS is a no-op on existing tables, so columns
  // added after the table was first created may be missing.
  ensureColumns(db);

  if (currentVersion >= SCHEMA_VERSION) return;

  // Schema upgrades are handled by CREATE IF NOT EXISTS in the main schema.
  // The Python implementation uses incremental ALTER TABLE statements for upgrades
  // from older versions. Since Setlist starts fresh at v8, we only need to handle
  // the case of opening an older Python-created database.

  if (currentVersion < 4) {
    // v0-v3 → v4: add display_name
    const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    if (!cols.some(c => c.name === 'display_name')) {
      db.exec(`ALTER TABLE projects ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`);
    }
  }

  if (currentVersion < 5) {
    // v4 → v5: capabilities table (handled by CREATE IF NOT EXISTS)
  }

  if (currentVersion < 6) {
    // v5 → v6: add invocation metadata to capabilities
    try {
      db.exec(`ALTER TABLE project_capabilities ADD COLUMN requires_auth INTEGER`);
      db.exec(`ALTER TABLE project_capabilities ADD COLUMN invocation_model TEXT NOT NULL DEFAULT ''`);
      db.exec(`ALTER TABLE project_capabilities ADD COLUMN audience TEXT NOT NULL DEFAULT ''`);
    } catch { /* columns may already exist */ }
  }

  if (currentVersion < 7) {
    // v6 → v7: memory subsystem (handled by CREATE IF NOT EXISTS)
  }

  if (currentVersion < 8) {
    // v7 → v8: add is_pinned to memories
    try {
      db.exec(`ALTER TABLE memories ADD COLUMN is_pinned INTEGER DEFAULT 0`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned, status)`);
    } catch { /* column may already exist */ }
  }

  if (currentVersion >= 8 && currentVersion < 9) {
    // v8 → v9: add 'observation' to memories type CHECK constraint.
    // Only runs on databases actually at v8 (not fresh installs which start at v10).
    // SQLite cannot ALTER CHECK constraints, so recreate the table.
    db.exec(`DROP TABLE IF EXISTS memories_v9`);
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE memories_v9 (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          content_l0 TEXT,
          content_l1 TEXT,
          type TEXT NOT NULL CHECK (type IN ('decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'skill', 'observation')),
          importance REAL DEFAULT 0.5,
          confidence REAL DEFAULT 0.5,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consolidating', 'archived', 'superseded')),
          project_id TEXT,
          scope TEXT DEFAULT 'project' CHECK (scope IN ('project', 'area_of_focus', 'portfolio', 'global')),
          agent_role TEXT,
          session_id TEXT,
          tags TEXT,
          content_hash TEXT NOT NULL,
          embedding BLOB,
          embedding_model TEXT,
          embedding_new BLOB,
          embedding_model_new TEXT,
          reinforcement_count INTEGER DEFAULT 1,
          outcome_score REAL DEFAULT 0.0,
          is_static INTEGER DEFAULT 0,
          is_inference INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_accessed TEXT,
          forget_after TEXT,
          forget_reason TEXT,
          UNIQUE(content_hash, project_id, scope)
      );
      INSERT INTO memories_v9 SELECT * FROM memories;
      DROP TABLE memories;
      ALTER TABLE memories_v9 RENAME TO memories;
      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);
      CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned, status);
    `);
    createFtsTriggers(db);
    db.pragma('foreign_keys = ON');
  }

  if (currentVersion >= 9 && currentVersion < 10) {
    // v9 → v10: unified memory model for chorus integration.
    // Only runs on databases actually at v9 (not fresh installs which start at v10).
    // Add types: learning, context, procedural. Remove: skill (migrated to procedural).
    // Add columns: belief, extraction_confidence, valid_from, valid_until, entities, parent_version_id, is_current.
    {
      db.exec(`DROP TABLE IF EXISTS memories_v10`);
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE memories_v10 (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            content_l0 TEXT,
            content_l1 TEXT,
            type TEXT NOT NULL CHECK (type IN ('decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'learning', 'context', 'procedural', 'observation')),
            importance REAL DEFAULT 0.5,
            confidence REAL DEFAULT 0.5,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consolidating', 'archived', 'superseded')),
            project_id TEXT,
            scope TEXT DEFAULT 'project' CHECK (scope IN ('project', 'area_of_focus', 'portfolio', 'global')),
            agent_role TEXT,
            session_id TEXT,
            tags TEXT,
            content_hash TEXT NOT NULL,
            embedding BLOB,
            embedding_model TEXT,
            embedding_new BLOB,
            embedding_model_new TEXT,
            reinforcement_count INTEGER DEFAULT 1,
            outcome_score REAL DEFAULT 0.0,
            is_static INTEGER DEFAULT 0,
            is_inference INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,
            belief TEXT CHECK (belief IN ('fact', 'opinion', 'hypothesis')),
            extraction_confidence REAL,
            valid_from TEXT,
            valid_until TEXT,
            entities TEXT,
            parent_version_id TEXT REFERENCES memories_v10(id),
            is_current INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_accessed TEXT,
            forget_after TEXT,
            forget_reason TEXT,
            UNIQUE(content_hash, project_id, scope)
        );
        INSERT INTO memories_v10 (
            id, content, content_l0, content_l1,
            type,
            importance, confidence, status, project_id, scope,
            agent_role, session_id, tags, content_hash,
            embedding, embedding_model, embedding_new, embedding_model_new,
            reinforcement_count, outcome_score, is_static, is_inference, is_pinned,
            belief, extraction_confidence, valid_from, valid_until, entities, parent_version_id, is_current,
            created_at, updated_at, last_accessed, forget_after, forget_reason
        )
        SELECT
            id, content, content_l0, content_l1,
            CASE WHEN type = 'skill' THEN 'procedural' ELSE type END,
            importance, confidence, status, project_id, scope,
            agent_role, session_id, tags, content_hash,
            embedding, embedding_model, embedding_new, embedding_model_new,
            reinforcement_count, outcome_score, is_static, is_inference, is_pinned,
            NULL, NULL, NULL, NULL, NULL, NULL, 1,
            created_at, updated_at, last_accessed, forget_after, forget_reason
        FROM memories;
        DROP TABLE memories;
        ALTER TABLE memories_v10 RENAME TO memories;
        CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, status);
        CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, status);
        CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type, status);
        CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);
        CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned, status);
        CREATE INDEX IF NOT EXISTS idx_memories_current ON memories(type, is_current) WHERE type = 'procedural';
      `);
      createFtsTriggers(db);
      db.pragma('foreign_keys = ON');
    }
  }

  if (currentVersion >= 10 && currentVersion < 11) {
    // v10 → v11: canonical areas, structural area_id + parent_project_id,
    // narrow projects.type CHECK to ('project'), retire area_of_focus.
    // Memories.scope: area_of_focus → area. Atomic.
    //
    // NOTE: PRAGMA foreign_keys is a no-op inside a transaction, and the
    // table-rebuild pattern inside the migration drops and recreates tables
    // that child rows reference. Toggle FKs OFF *before* opening the
    // transaction, then restore on the way out.
    db.pragma('foreign_keys = OFF');
    try {
      const runMigration = db.transaction(() => runV10ToV11Migration(db));
      runMigration();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  if (currentVersion >= 11 && currentVersion < 12) {
    // v11 → v12: add project_digests table for free-form per-project essence
    // summaries. No data migration; the table starts empty and is populated
    // on demand via `setlist digest refresh`.
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_digests (
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          digest_kind TEXT NOT NULL DEFAULT 'essence',
          digest_text TEXT NOT NULL,
          spec_version TEXT NOT NULL,
          producer TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          token_count INTEGER,
          PRIMARY KEY (project_id, digest_kind)
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_project_digests_project ON project_digests(project_id)`);
  }

  if (currentVersion >= 12 && currentVersion < 13) {
    // v12 → v13: project_types as first-class user-managed entities, and
    // projects.project_type_id FK. The project_types table is already
    // created by SCHEMA_SQL above (CREATE IF NOT EXISTS), and the
    // project_type_id column is added by ensureColumns. This migration
    // block seeds the two default types and backfills existing projects:
    //   - paths containing /Code/  → "Code project"
    //   - everything else          → "Non-code project"
    //
    // Idempotent: re-running on a v13 database is a no-op (the seed uses
    // INSERT OR IGNORE; backfill only updates rows where project_type_id
    // is NULL).
    seedProjectTypes(db);

    const codeTypeRow = db.prepare(`SELECT id FROM project_types WHERE name = ?`).get('Code project') as { id: number } | undefined;
    const nonCodeTypeRow = db.prepare(`SELECT id FROM project_types WHERE name = ?`).get('Non-code project') as { id: number } | undefined;

    if (codeTypeRow && nonCodeTypeRow) {
      // For each project that has no project_type_id yet, assign by path heuristic.
      const toBackfill = db.prepare(
        `SELECT p.id AS project_id,
                (SELECT pp.path FROM project_paths pp WHERE pp.project_id = p.id LIMIT 1) AS path
         FROM projects p
         WHERE p.project_type_id IS NULL`
      ).all() as { project_id: number; path: string | null }[];

      const update = db.prepare(`UPDATE projects SET project_type_id = ?, updated_at = datetime('now') WHERE id = ?`);
      for (const row of toBackfill) {
        const isCode = row.path && row.path.includes('/Code/');
        update.run(isCode ? codeTypeRow.id : nonCodeTypeRow.id, row.project_id);
      }
    }

    // Defensive: if any residual rows still claim type='area_of_focus'
    // (from a registry that skipped the v10→v11 path), demote them now.
    db.prepare(`UPDATE projects SET type = 'project', updated_at = datetime('now') WHERE type = 'area_of_focus'`).run();
  }

  if (currentVersion >= 13 && currentVersion < 14) {
    // v13 → v14: user-composable bootstrap primitives (spec 0.28).
    //
    // The bootstrap_primitives and project_type_recipe_steps tables are
    // already created by SCHEMA_SQL above (CREATE IF NOT EXISTS). This
    // migration block:
    //   1. Seeds the four built-in primitives (create-folder, copy-template,
    //      git-init, update-parent-gitignore).
    //   2. Binds the seeded built-ins to the two seeded project types
    //      (Code project, Non-code project) so existing recipes reproduce
    //      v0.27 behavior.
    //
    // Idempotent: seedBuiltinPrimitives uses INSERT OR IGNORE keyed on
    // builtin_key; seedBuiltinRecipes only binds when the type's recipe is
    // currently empty, so user customizations are preserved.
    seedBuiltinPrimitives(db);
    seedBuiltinRecipes(db);
  }

  db.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
}

/**
 * v10 → v11 migration. Runs inside a transaction on the live database.
 * Steps:
 *   1. Ensure `areas` table exists and is seeded with the 7 canonical areas.
 *   2. Ensure `area_id` + `parent_project_id` columns exist on projects.
 *   3. Demote any area_of_focus-typed rows to project; assign canonical areas
 *      for msq-advisory-board (Work) and fam-estate-planning (Family);
 *      leave other demoted rows with area_id = NULL.
 *   4. Promote knowmarks-ios ↔ knowmarks entity soft link to parent_project_id.
 *   5. Narrow projects.type CHECK from ('project','area_of_focus') → ('project')
 *      via table-rebuild (SQLite cannot alter CHECK in place).
 *   6. Remap memories.scope value 'area_of_focus' → 'area' via table-rebuild.
 */
function runV10ToV11Migration(db: Database.Database): void {
  // Step 1: areas table + seed (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT ''
    );
  `);
  seedAreas(db);

  // Step 2: columns (idempotent via ensureColumns at the ALTER level)
  const projCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  const projColNames = new Set(projCols.map(c => c.name));
  if (!projColNames.has('area_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN area_id INTEGER REFERENCES areas(id)`);
  }
  if (!projColNames.has('parent_project_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN parent_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`);
  }

  const areaIdByName = new Map<string, number>();
  for (const row of db.prepare('SELECT id, name FROM areas').all() as { id: number; name: string }[]) {
    areaIdByName.set(row.name, row.id);
  }

  // Step 3: demote area_of_focus rows
  const demotions: { name: string; area: string | null }[] = [
    { name: 'msq-advisory-board', area: 'Work' },
    { name: 'fam-estate-planning', area: 'Family' },
  ];
  for (const d of demotions) {
    const row = db.prepare(`SELECT id FROM projects WHERE name = ? AND type = 'area_of_focus'`).get(d.name) as { id: number } | undefined;
    if (row) {
      const areaId = d.area ? areaIdByName.get(d.area) ?? null : null;
      db.prepare(`UPDATE projects SET type = 'project', area_id = ?, updated_at = datetime('now') WHERE id = ?`).run(areaId, row.id);
    }
  }
  // Any remaining area_of_focus rows: demote to project with area_id=NULL
  db.prepare(`UPDATE projects SET type = 'project', updated_at = datetime('now') WHERE type = 'area_of_focus'`).run();

  // Step 4: knowmarks-ios ↔ knowmarks soft-link promotion
  const kIos = db.prepare(`SELECT id, entities FROM projects WHERE name = 'knowmarks-ios'`).get() as { id: number; entities: string } | undefined;
  const kParent = db.prepare(`SELECT id FROM projects WHERE name = 'knowmarks'`).get() as { id: number } | undefined;
  if (kIos && kParent) {
    let refsKnowmarks = false;
    try {
      const parsed = JSON.parse(kIos.entities || '[]');
      if (Array.isArray(parsed) && parsed.map(String).some(e => e.toLowerCase() === 'knowmarks')) {
        refsKnowmarks = true;
      }
    } catch { /* ignore */ }
    if (refsKnowmarks) {
      db.prepare(`UPDATE projects SET parent_project_id = ?, updated_at = datetime('now') WHERE id = ?`).run(kParent.id, kIos.id);
    }
  }

  // Step 5: narrow projects.type CHECK via table-rebuild.
  // Caller has already disabled foreign_keys outside the transaction.
  db.exec(`DROP TABLE IF EXISTS projects_v11`);
  db.exec(`
    CREATE TABLE projects_v11 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK (type IN ('project')),
      status TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT '',
      topics TEXT NOT NULL DEFAULT '[]',
      entities TEXT NOT NULL DEFAULT '[]',
      concerns TEXT NOT NULL DEFAULT '[]',
      area_id INTEGER REFERENCES areas(id),
      parent_project_id INTEGER REFERENCES projects_v11(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    INSERT INTO projects_v11 (id, name, display_name, type, status, description, goals, topics, entities, concerns, area_id, parent_project_id, created_at, updated_at)
    SELECT id, name, display_name, type, status, description, goals, topics, entities, concerns, area_id, parent_project_id, created_at, updated_at FROM projects;
  `);
  db.exec(`DROP TABLE projects`);
  db.exec(`ALTER TABLE projects_v11 RENAME TO projects`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_type_status ON projects(type, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_area_id ON projects(area_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id ON projects(parent_project_id)`);

  // Step 6: narrow memories.scope CHECK via table-rebuild and remap values
  db.exec(`DROP TABLE IF EXISTS memories_v11`);
  db.exec(`
    CREATE TABLE memories_v11 (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      content_l0 TEXT,
      content_l1 TEXT,
      type TEXT NOT NULL CHECK (type IN ('decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'learning', 'context', 'procedural', 'observation')),
      importance REAL DEFAULT 0.5,
      confidence REAL DEFAULT 0.5,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consolidating', 'archived', 'superseded')),
      project_id TEXT,
      scope TEXT DEFAULT 'project' CHECK (scope IN ('project', 'area', 'portfolio', 'global')),
      agent_role TEXT,
      session_id TEXT,
      tags TEXT,
      content_hash TEXT NOT NULL,
      embedding BLOB,
      embedding_model TEXT,
      embedding_new BLOB,
      embedding_model_new TEXT,
      reinforcement_count INTEGER DEFAULT 1,
      outcome_score REAL DEFAULT 0.0,
      is_static INTEGER DEFAULT 0,
      is_inference INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      belief TEXT CHECK (belief IN ('fact', 'opinion', 'hypothesis')),
      extraction_confidence REAL,
      valid_from TEXT,
      valid_until TEXT,
      entities TEXT,
      parent_version_id TEXT REFERENCES memories_v11(id),
      is_current INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_accessed TEXT,
      forget_after TEXT,
      forget_reason TEXT,
      UNIQUE(content_hash, project_id, scope)
    );
  `);
  db.exec(`
    INSERT INTO memories_v11 SELECT
      id, content, content_l0, content_l1,
      type, importance, confidence, status, project_id,
      CASE WHEN scope = 'area_of_focus' THEN 'area' ELSE scope END AS scope,
      agent_role, session_id, tags, content_hash,
      embedding, embedding_model, embedding_new, embedding_model_new,
      reinforcement_count, outcome_score, is_static, is_inference, is_pinned,
      belief, extraction_confidence, valid_from, valid_until, entities, parent_version_id, is_current,
      created_at, updated_at, last_accessed, forget_after, forget_reason
    FROM memories;
  `);
  db.exec(`DROP TABLE memories`);
  db.exec(`ALTER TABLE memories_v11 RENAME TO memories`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned, status)`);
  createFtsTriggers(db);
  // Rebuild FTS content for memories rows
  db.exec(`DELETE FROM memory_fts`);
  db.exec(`INSERT INTO memory_fts(memory_id, content, content_l0, content_l1) SELECT id, content, content_l0, content_l1 FROM memories`);
}

/**
 * Open a database connection with proper settings (WAL mode, foreign keys).
 */
export function connect(dbPath?: string): Database.Database {
  const path = dbPath ?? getDbPath();
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Initialize the database: create tables, apply schema, seed catalog and templates.
 * Returns the path to the initialized database.
 */
export function initDb(dbPath?: string): string {
  const path = dbPath ?? getDbPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = connect(path);
  try {
    db.exec(SCHEMA_SQL);
    createFtsTriggers(db);
    upgradeSchema(db);
    seedAreas(db);
    seedProjectTypes(db);
    seedFieldCatalog(db);
    seedTemplates(db);
    // Spec 0.28: seed built-in primitives + bind to seeded recipes so a fresh
    // install reproduces v0.27 bootstrap behavior out of the box.
    seedBuiltinPrimitives(db);
    seedBuiltinRecipes(db);
  } finally {
    db.close();
  }

  return path;
}

/**
 * Get the template fields for a project type.
 * spec 0.13: only 'project' exists; template defaults to code_project. The
 * legacy 'area_of_focus' template row is retained in seed data for migration
 * diff purposes but is never selected at runtime.
 */
export function getTemplateFields(db: Database.Database, _projectType: string): Set<string> {
  const templateName = 'code_project';

  const rows = db.prepare(`
    SELECT tf.field_name
    FROM template_fields tf
    JOIN templates t ON t.id = tf.template_id
    WHERE t.name = ?
  `).all(templateName) as { field_name: string }[];

  return new Set(rows.map(r => r.field_name));
}
