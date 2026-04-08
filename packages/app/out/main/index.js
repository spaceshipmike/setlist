import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname, basename } from "node:path";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, cpSync, rmSync, renameSync, statSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import pkg from "electron-updater";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const SCHEMA_VERSION = 10;
const DEFAULT_DB_DIR = join(homedir(), ".local", "share", "project-registry");
const DEFAULT_DB_NAME = "registry.db";
function getDbPath() {
  return join(DEFAULT_DB_DIR, DEFAULT_DB_NAME);
}
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('project', 'area_of_focus')),
    status TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    goals TEXT NOT NULL DEFAULT '',
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type_status ON projects(type, status);
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
`;
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
const FIELD_CATALOG_SEED = [
  ["tech_stack", "list", "technical", "Technology stack", 1],
  ["patterns", "list", "technical", "Architectural patterns", 1],
  ["keywords", "list", "technical", "Keywords for search", 1],
  ["ide", "string", "tooling", "IDE or editor", 0],
  ["terminal_profile", "string", "tooling", "Terminal profile name", 0],
  ["mcp_servers", "list", "tooling", "MCP server configurations", 1],
  ["urls", "list", "tooling", "Associated URLs", 1],
  ["stakeholders", "text", "context", "Key stakeholders", 0],
  ["timeline", "text", "context", "Timeline or milestones", 0],
  ["domain", "text", "context", "Domain context", 0],
  ["short_description", "string", "identity", "Short description", 0],
  ["medium_description", "text", "identity", "Medium description", 0],
  ["readme_description", "text", "identity", "README description", 0]
];
const TEMPLATE_SEED = {
  code_project: {
    description: "Template for code projects with technical fields",
    fields: ["tech_stack", "patterns", "mcp_servers", "urls", "keywords", "short_description", "medium_description", "readme_description"]
  },
  non_code_project: {
    description: "Template for non-code projects with context fields",
    fields: ["stakeholders", "timeline", "domain", "keywords", "short_description", "medium_description"]
  },
  area_of_focus: {
    description: "Template for areas of focus",
    fields: ["keywords", "short_description", "medium_description"]
  }
};
function createFtsTriggers(db) {
  const triggers = FTS_TRIGGERS_SQL.split(/END;/i).map((s) => s.trim()).filter((s) => s.length > 0).map((s) => s + " END;");
  for (const trigger of triggers) {
    try {
      db.exec(trigger);
    } catch {
    }
  }
}
function seedFieldCatalog(db) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO field_catalog (name, field_type, category, description, is_list) VALUES (?, ?, ?, ?, ?)`);
  for (const entry of FIELD_CATALOG_SEED) {
    stmt.run(...entry);
  }
}
function seedTemplates(db) {
  for (const [name, config] of Object.entries(TEMPLATE_SEED)) {
    const existing = db.prepare("SELECT id FROM templates WHERE name = ?").get(name);
    let templateId;
    if (existing) {
      templateId = existing.id;
    } else {
      const result = db.prepare("INSERT INTO templates (name, description) VALUES (?, ?)").run(name, config.description);
      templateId = Number(result.lastInsertRowid);
    }
    const insertField = db.prepare("INSERT OR IGNORE INTO template_fields (template_id, field_name) VALUES (?, ?)");
    for (const field of config.fields) {
      insertField.run(templateId, field);
    }
  }
}
function ensureColumns(db) {
  const capCols = db.prepare("PRAGMA table_info(project_capabilities)").all();
  const capColNames = new Set(capCols.map((c) => c.name));
  if (!capColNames.has("requires_auth")) {
    db.exec(`ALTER TABLE project_capabilities ADD COLUMN requires_auth INTEGER`);
  }
  if (!capColNames.has("invocation_model")) {
    db.exec(`ALTER TABLE project_capabilities ADD COLUMN invocation_model TEXT NOT NULL DEFAULT ''`);
  }
  if (!capColNames.has("audience")) {
    db.exec(`ALTER TABLE project_capabilities ADD COLUMN audience TEXT NOT NULL DEFAULT ''`);
  }
  const projCols = db.prepare("PRAGMA table_info(projects)").all();
  const projColNames = new Set(projCols.map((c) => c.name));
  if (!projColNames.has("topics")) {
    db.exec(`ALTER TABLE projects ADD COLUMN topics TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!projColNames.has("entities")) {
    db.exec(`ALTER TABLE projects ADD COLUMN entities TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!projColNames.has("concerns")) {
    db.exec(`ALTER TABLE projects ADD COLUMN concerns TEXT NOT NULL DEFAULT '[]'`);
  }
}
function upgradeSchema(db) {
  const meta = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get();
  const currentVersion = meta ? parseInt(meta.value, 10) : 0;
  ensureColumns(db);
  if (currentVersion >= SCHEMA_VERSION)
    return;
  if (currentVersion < 4) {
    const cols = db.prepare("PRAGMA table_info(projects)").all();
    if (!cols.some((c) => c.name === "display_name")) {
      db.exec(`ALTER TABLE projects ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`);
    }
  }
  if (currentVersion < 6) {
    try {
      db.exec(`ALTER TABLE project_capabilities ADD COLUMN requires_auth INTEGER`);
      db.exec(`ALTER TABLE project_capabilities ADD COLUMN invocation_model TEXT NOT NULL DEFAULT ''`);
      db.exec(`ALTER TABLE project_capabilities ADD COLUMN audience TEXT NOT NULL DEFAULT ''`);
    } catch {
    }
  }
  if (currentVersion < 8) {
    try {
      db.exec(`ALTER TABLE memories ADD COLUMN is_pinned INTEGER DEFAULT 0`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned, status)`);
    } catch {
    }
  }
  if (currentVersion >= 8 && currentVersion < 9) {
    db.exec(`DROP TABLE IF EXISTS memories_v9`);
    db.pragma("foreign_keys = OFF");
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
    db.pragma("foreign_keys = ON");
  }
  if (currentVersion >= 9 && currentVersion < 10) {
    {
      db.exec(`DROP TABLE IF EXISTS memories_v10`);
      db.pragma("foreign_keys = OFF");
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
      db.pragma("foreign_keys = ON");
    }
  }
  db.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
}
function connect(dbPath) {
  const path = dbPath ?? getDbPath();
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
function initDb(dbPath) {
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
    seedFieldCatalog(db);
    seedTemplates(db);
  } finally {
    db.close();
  }
  return path;
}
function getTemplateFields(db, projectType) {
  let templateName;
  if (projectType === "area_of_focus") {
    templateName = "area_of_focus";
  } else {
    templateName = "code_project";
  }
  const rows = db.prepare(`
    SELECT tf.field_name
    FROM template_fields tf
    JOIN templates t ON t.id = tf.template_id
    WHERE t.name = ?
  `).all(templateName);
  return new Set(rows.map((r) => r.field_name));
}
const PROJECT_STATUSES = /* @__PURE__ */ new Set([
  "idea",
  "draft",
  "active",
  "paused",
  "archived",
  "complete"
]);
const AREA_STATUSES = /* @__PURE__ */ new Set([
  "active",
  "paused"
]);
const STATUS_BY_TYPE = {
  project: PROJECT_STATUSES,
  area_of_focus: AREA_STATUSES
};
const MEMORY_TYPES = /* @__PURE__ */ new Set([
  "decision",
  "outcome",
  "pattern",
  "preference",
  "dependency",
  "correction",
  "learning",
  "context",
  "procedural",
  "observation"
]);
const MEMORY_BELIEFS = /* @__PURE__ */ new Set(["fact", "opinion", "hypothesis"]);
const MEMORY_SCOPES = /* @__PURE__ */ new Set([
  "project",
  "area_of_focus",
  "portfolio",
  "global"
]);
function validateStatus(projectType, status) {
  const allowed = STATUS_BY_TYPE[projectType];
  if (!allowed) {
    throw new Error(`Unknown project type: ${projectType}. Must be 'project' or 'area_of_focus'.`);
  }
  if (!allowed.has(status)) {
    throw new Error(`Invalid status '${status}' for type '${projectType}'. Allowed: ${[...allowed].join(", ")}`);
  }
}
function toSummary(record) {
  const result = {
    name: record.name,
    display_name: record.display_name,
    type: record.type,
    status: record.status,
    updated_at: record.updated_at
  };
  if (record.description)
    result.description = record.description;
  return result;
}
function toStandard(record, templateFields) {
  const result = toSummary(record);
  if (record.goals)
    result.goals = parseJsonArray(record.goals);
  if (record.paths.length > 0)
    result.paths = record.paths;
  const topics = parseJsonArray(record.topics);
  const entities = parseJsonArray(record.entities);
  const concerns = parseJsonArray(record.concerns);
  if (topics.length > 0)
    result.topics = topics;
  if (entities.length > 0)
    result.entities = entities;
  if (concerns.length > 0)
    result.concerns = concerns;
  const filtered = {};
  for (const [key, value] of Object.entries(record.extended_fields)) {
    if (templateFields.has(key)) {
      filtered[key] = value;
    }
  }
  if (Object.keys(filtered).length > 0)
    result.fields = filtered;
  return result;
}
function parseJsonArray(value) {
  if (!value)
    return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
    }
  }
  return trimmed.split(/[,\n]/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}
function toFull(record) {
  const result = {
    name: record.name,
    display_name: record.display_name,
    type: record.type,
    status: record.status
  };
  if (record.description)
    result.description = record.description;
  if (record.goals)
    result.goals = parseJsonArray(record.goals);
  if (record.paths.length > 0)
    result.paths = record.paths;
  const topics = parseJsonArray(record.topics);
  const entities = parseJsonArray(record.entities);
  const concerns = parseJsonArray(record.concerns);
  if (topics.length > 0)
    result.topics = topics;
  if (entities.length > 0)
    result.entities = entities;
  if (concerns.length > 0)
    result.concerns = concerns;
  if (Object.keys(record.extended_fields).length > 0) {
    result.fields = { ...record.extended_fields };
  }
  if (record.capabilities.length > 0)
    result.capabilities = record.capabilities;
  result.created_at = record.created_at;
  result.updated_at = record.updated_at;
  return result;
}
class RegistryError extends Error {
  code;
  suggestion;
  constructor(code, message, suggestion) {
    const full = suggestion ? `Error [${code}]: ${message} Suggestion: ${suggestion}` : `Error [${code}]: ${message}`;
    super(full);
    this.name = "RegistryError";
    this.code = code;
    this.suggestion = suggestion;
  }
}
class DuplicateProjectError extends RegistryError {
  constructor(name) {
    super("DUPLICATE", `A project named '${name}' already exists.`, `Use update_project() to modify it, or get_project() to see current data.`);
    this.name = "DuplicateProjectError";
  }
}
class NotFoundError extends RegistryError {
  constructor(name, suggestion) {
    const suggestionText = suggestion ? `Did you mean '${suggestion}'? Use get_project('${suggestion}') to check.` : `Use list_projects() to see available projects.`;
    super("NOT_FOUND", `No project named '${name}' found.`, suggestionText);
    this.name = "NotFoundError";
  }
}
class InvalidInputError extends RegistryError {
  constructor(message) {
    super("INVALID_INPUT", message);
    this.name = "InvalidInputError";
  }
}
function findClosestMatch(target, candidates) {
  if (candidates.length === 0)
    return void 0;
  let bestMatch;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const tLower = target.toLowerCase();
    const cLower = candidate.toLowerCase();
    const fullDist = levenshtein(tLower, cLower);
    const fullThreshold = Math.max(Math.floor(Math.max(target.length, candidate.length) * 0.5), 3);
    if (fullDist < bestDistance && fullDist <= fullThreshold) {
      bestDistance = fullDist;
      bestMatch = candidate;
      continue;
    }
    if (candidate.length > target.length) {
      const prefix = cLower.slice(0, tLower.length);
      const prefixDist = levenshtein(tLower, prefix);
      if (prefixDist <= 2 && prefixDist < bestDistance) {
        bestDistance = prefixDist;
        bestMatch = candidate;
      }
    }
  }
  return bestMatch;
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++)
    dp[i][0] = i;
  for (let j = 0; j <= n; j++)
    dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
function serializeFieldValue(value) {
  if (Array.isArray(value))
    return JSON.stringify(value);
  if (typeof value === "object" && value !== null)
    return JSON.stringify(value);
  return String(value);
}
function writeFields(db, projectId, fields, producer) {
  const upsert = db.prepare(`
    INSERT INTO project_fields (project_id, field_name, field_value, producer, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(project_id, field_name) DO UPDATE SET
      field_value = excluded.field_value,
      producer = excluded.producer,
      updated_at = excluded.updated_at
    WHERE project_fields.producer = excluded.producer
  `);
  for (const [name, value] of Object.entries(fields)) {
    if (value === void 0 || value === null)
      continue;
    upsert.run(projectId, name, serializeFieldValue(value), producer);
  }
}
const PORT_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
  "package.json",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env",
  ".env.local",
  ".env.development",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "angular.json",
  "webpack.config.js",
  "nuxt.config.ts",
  "nuxt.config.js"
];
function discoverPortsInPath(projectPath) {
  const discovered = [];
  const seen = /* @__PURE__ */ new Set();
  for (const file of PORT_CONFIG_FILES) {
    const fullPath = join(projectPath, file);
    if (!existsSync(fullPath))
      continue;
    try {
      const content = readFileSync(fullPath, "utf-8");
      const ports = extractPorts(content, file);
      for (const p of ports) {
        if (!seen.has(p.port)) {
          seen.add(p.port);
          discovered.push({ ...p, source_file: file });
        }
      }
    } catch {
    }
  }
  return discovered;
}
function extractPorts(content, filename) {
  const base = basename(filename);
  const results = [];
  if (base.startsWith("vite.config")) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "vite dev server" });
    }
  } else if (base === "package.json") {
    const matches = content.matchAll(/--port[= ](\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "dev script" });
    }
  } else if (base.startsWith("docker-compose")) {
    const matches = content.matchAll(/["']?(\d+):\d+["']?/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "docker-compose" });
    }
  } else if (base.startsWith(".env")) {
    const matches = content.matchAll(/^PORT\s*=\s*(\d+)/gm);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "env PORT" });
    }
  } else if (base.startsWith("next.config")) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "next dev server" });
    }
  } else if (base === "angular.json") {
    const matches = content.matchAll(/"port"\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "angular dev server" });
    }
  } else if (base.startsWith("webpack.config")) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "webpack dev server" });
    }
  } else if (base.startsWith("nuxt.config")) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: "nuxt dev server" });
    }
  }
  return results.filter((p) => p.port >= 1 && p.port <= 65535);
}
const PORT_RANGE_MIN = 3e3;
const PORT_RANGE_MAX = 9999;
class Registry {
  _dbPath;
  constructor(dbPath) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }
  get dbPath() {
    return this._dbPath;
  }
  open() {
    return connect(this._dbPath);
  }
  // ── Registration ──────────────────────────────────────────────
  register(opts) {
    validateStatus(opts.type, opts.status);
    const displayName = opts.display_name || opts.name;
    const producer = opts.producer ?? "system";
    const db = this.open();
    try {
      const existing = db.prepare("SELECT id FROM projects WHERE name = ?").get(opts.name);
      if (existing)
        throw new DuplicateProjectError(opts.name);
      const result = db.prepare(`INSERT INTO projects (name, display_name, type, status, description, goals) VALUES (?, ?, ?, ?, ?, ?)`).run(opts.name, displayName, opts.type, opts.status, opts.description ?? "", opts.goals ?? "");
      const projectId = Number(result.lastInsertRowid);
      if (opts.paths) {
        const insertPath = db.prepare(`INSERT INTO project_paths (project_id, path, added_by) VALUES (?, ?, ?)`);
        for (const p of opts.paths) {
          insertPath.run(projectId, p, producer);
        }
      }
      if (opts.fields) {
        writeFields(db, projectId, opts.fields, producer);
      }
      return projectId;
    } finally {
      db.close();
    }
  }
  // ── Querying ──────────────────────────────────────────────────
  getProject(name, depth = "standard") {
    const db = this.open();
    try {
      const record = this.loadRecord(db, { name });
      if (!record)
        return null;
      return this.formatRecord(db, record, depth);
    } finally {
      db.close();
    }
  }
  /**
   * Get a project by name, throwing NotFoundError with fuzzy suggestion if not found.
   */
  getProjectOrThrow(name, depth = "standard") {
    const db = this.open();
    try {
      const record = this.loadRecord(db, { name });
      if (!record) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        const closest = findClosestMatch(name, allNames.map((r) => r.name));
        throw new NotFoundError(name, closest);
      }
      return this.formatRecord(db, record, depth);
    } finally {
      db.close();
    }
  }
  listProjects(opts) {
    const depth = opts?.depth ?? "summary";
    const db = this.open();
    try {
      let sql = "SELECT * FROM projects";
      const conditions = [];
      const params = [];
      if (opts?.type_filter) {
        conditions.push("type = ?");
        params.push(opts.type_filter);
      }
      if (opts?.status_filter) {
        conditions.push("status = ?");
        params.push(opts.status_filter);
      }
      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY name";
      const rows = db.prepare(sql).all(...params);
      return rows.map((row) => {
        const record = this.rowToRecord(db, row);
        return this.formatRecord(db, record, depth);
      });
    } finally {
      db.close();
    }
  }
  searchProjects(opts) {
    const db = this.open();
    try {
      const q = `%${opts.query}%`;
      let sql = `
        SELECT DISTINCT p.* FROM projects p
        LEFT JOIN project_fields pf ON pf.project_id = p.id
        WHERE (
          p.name LIKE ? OR p.display_name LIKE ? OR p.description LIKE ?
          OR p.goals LIKE ? OR p.topics LIKE ? OR p.entities LIKE ?
          OR p.concerns LIKE ? OR pf.field_value LIKE ?
        )
      `;
      const params = [q, q, q, q, q, q, q, q];
      if (opts.type_filter) {
        sql += " AND p.type = ?";
        params.push(opts.type_filter);
      }
      if (opts.status_filter) {
        sql += " AND p.status = ?";
        params.push(opts.status_filter);
      }
      sql += " ORDER BY p.name";
      const rows = db.prepare(sql).all(...params);
      return rows.map((row) => {
        const record = this.rowToRecord(db, row);
        return this.formatRecord(db, record, "summary");
      });
    } finally {
      db.close();
    }
  }
  getRegistryStats() {
    const db = this.open();
    try {
      const total = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
      const typeRows = db.prepare("SELECT type, COUNT(*) as count FROM projects GROUP BY type").all();
      const statusRows = db.prepare("SELECT status, COUNT(*) as count FROM projects GROUP BY status").all();
      const by_type = {};
      for (const r of typeRows)
        by_type[r.type] = r.count;
      const by_status = {};
      for (const r of statusRows)
        by_status[r.status] = r.count;
      return { total, by_type, by_status };
    } finally {
      db.close();
    }
  }
  switchProject(name) {
    const db = this.open();
    try {
      const record = this.loadRecord(db, { name });
      if (!record) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        const closest = findClosestMatch(name, allNames.map((r) => r.name));
        throw new NotFoundError(name, closest);
      }
      const result = this.formatRecord(db, record, "full");
      const ports = this.loadPorts(db, record.id);
      if (ports.length > 0)
        result.ports = ports;
      return result;
    } finally {
      db.close();
    }
  }
  // ── Update / Archive ──────────────────────────────────────────
  updateCore(name, updates) {
    const db = this.open();
    try {
      const row = db.prepare("SELECT id, type FROM projects WHERE name = ?").get(name);
      if (!row) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        const closest = findClosestMatch(name, allNames.map((r) => r.name));
        throw new NotFoundError(name, closest);
      }
      if (updates.status) {
        validateStatus(row.type, updates.status);
      }
      const sets = [];
      const params = [];
      if (updates.display_name !== void 0) {
        sets.push("display_name = ?");
        params.push(updates.display_name);
      }
      if (updates.status !== void 0) {
        sets.push("status = ?");
        params.push(updates.status);
      }
      if (updates.description !== void 0) {
        sets.push("description = ?");
        params.push(updates.description);
      }
      if (updates.goals !== void 0) {
        sets.push("goals = ?");
        params.push(updates.goals);
      }
      if (sets.length === 0)
        return;
      sets.push("updated_at = datetime('now')");
      params.push(row.id);
      db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    } finally {
      db.close();
    }
  }
  archiveProject(name) {
    const db = this.open();
    try {
      const row = db.prepare("SELECT id FROM projects WHERE name = ?").get(name);
      if (!row) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        const closest = findClosestMatch(name, allNames.map((r) => r.name));
        throw new NotFoundError(name, closest);
      }
      db.prepare("UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(row.id);
      const portsResult = db.prepare("DELETE FROM project_ports WHERE project_id = ?").run(row.id);
      const capsResult = db.prepare("DELETE FROM project_capabilities WHERE project_id = ?").run(row.id);
      return {
        ports_released: portsResult.changes,
        capabilities_cleared: capsResult.changes
      };
    } finally {
      db.close();
    }
  }
  renameProject(oldName, newName) {
    const db = this.open();
    try {
      const row = db.prepare("SELECT id FROM projects WHERE name = ?").get(oldName);
      if (!row) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        const closest = findClosestMatch(oldName, allNames.map((r) => r.name));
        throw new NotFoundError(oldName, closest);
      }
      const existing = db.prepare("SELECT id FROM projects WHERE name = ?").get(newName);
      if (existing)
        throw new DuplicateProjectError(newName);
      const doRename = db.transaction(() => {
        db.prepare("UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?").run(newName, row.id);
        db.prepare("UPDATE tasks SET project_name = ? WHERE project_name = ?").run(newName, oldName);
        db.prepare("UPDATE memories SET project_id = ? WHERE project_id = ?").run(newName, oldName);
        db.prepare("UPDATE memory_sources SET project_id = ? WHERE project_id = ?").run(newName, oldName);
      });
      doRename();
    } finally {
      db.close();
    }
  }
  // ── Profile Enrichment ────────────────────────────────────────
  enrichProject(name, profile) {
    const db = this.open();
    try {
      const row = db.prepare("SELECT id, goals, topics, entities, concerns FROM projects WHERE name = ?").get(name);
      if (!row) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        throw new NotFoundError(name, findClosestMatch(name, allNames.map((r) => r.name)));
      }
      const existingGoals = this._parseGoalsField(row.goals);
      const existingTopics = JSON.parse(row.topics || "[]");
      const existingEntities = JSON.parse(row.entities || "[]");
      const existingConcerns = JSON.parse(row.concerns || "[]");
      const mergedGoals = profile.goals ? [.../* @__PURE__ */ new Set([...existingGoals, ...profile.goals])] : existingGoals;
      const mergedTopics = profile.topics ? [.../* @__PURE__ */ new Set([...existingTopics, ...profile.topics.map((t) => t.toLowerCase())])] : existingTopics;
      const mergedEntities = profile.entities ? [.../* @__PURE__ */ new Set([...existingEntities, ...profile.entities.map((e) => e.toLowerCase())])] : existingEntities;
      const mergedConcerns = profile.concerns ? [.../* @__PURE__ */ new Set([...existingConcerns, ...profile.concerns.map((c) => c.toLowerCase())])] : existingConcerns;
      db.prepare(`UPDATE projects SET
        goals = ?, topics = ?, entities = ?, concerns = ?,
        updated_at = datetime('now')
        WHERE id = ?`).run(JSON.stringify(mergedGoals), JSON.stringify(mergedTopics), JSON.stringify(mergedEntities), JSON.stringify(mergedConcerns), row.id);
      return { name, goals: mergedGoals, topics: mergedTopics, entities: mergedEntities, concerns: mergedConcerns };
    } finally {
      db.close();
    }
  }
  /** Parse goals from either JSON array or legacy comma-separated string */
  _parseGoalsField(goals) {
    if (!goals)
      return [];
    const trimmed = goals.trim();
    if (trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
      }
    }
    return trimmed.split(/[,\n]/).map((g) => g.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  }
  // ── Fields ────────────────────────────────────────────────────
  updateFields(name, fields, producer, paths) {
    const db = this.open();
    try {
      const row = db.prepare("SELECT id FROM projects WHERE name = ?").get(name);
      if (!row) {
        const allNames = db.prepare("SELECT name FROM projects").all();
        throw new NotFoundError(name, findClosestMatch(name, allNames.map((r) => r.name)));
      }
      writeFields(db, row.id, fields, producer);
      if (paths) {
        const insertPath = db.prepare(`INSERT OR IGNORE INTO project_paths (project_id, path, added_by) VALUES (?, ?, ?)`);
        for (const p of paths)
          insertPath.run(row.id, p, producer);
      }
      db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(row.id);
    } finally {
      db.close();
    }
  }
  // ── Batch ─────────────────────────────────────────────────────
  batchUpdate(opts) {
    if (!opts.type_filter && !opts.status_filter) {
      throw new InvalidInputError("batch_update requires at least one filter (type_filter or status_filter).");
    }
    const hasUpdates = opts.status !== void 0 || opts.description !== void 0 || opts.goals !== void 0 || opts.display_name !== void 0;
    if (!hasUpdates) {
      throw new InvalidInputError("batch_update requires at least one field to update.");
    }
    const db = this.open();
    try {
      let sql = "SELECT id, name, type FROM projects";
      const conditions = [];
      const params = [];
      if (opts.type_filter) {
        conditions.push("type = ?");
        params.push(opts.type_filter);
      }
      if (opts.status_filter) {
        conditions.push("status = ?");
        params.push(opts.status_filter);
      }
      sql += " WHERE " + conditions.join(" AND ");
      const matched = db.prepare(sql).all(...params);
      const names = matched.map((m) => m.name);
      if (opts.dry_run) {
        return { count: matched.length, projects: names, dry_run: true };
      }
      if (opts.status) {
        for (const m of matched) {
          validateStatus(m.type, opts.status);
        }
      }
      const updateInTransaction = db.transaction(() => {
        for (const m of matched) {
          const sets = [];
          const updateParams = [];
          if (opts.display_name !== void 0) {
            sets.push("display_name = ?");
            updateParams.push(opts.display_name);
          }
          if (opts.status !== void 0) {
            sets.push("status = ?");
            updateParams.push(opts.status);
          }
          if (opts.description !== void 0) {
            sets.push("description = ?");
            updateParams.push(opts.description);
          }
          if (opts.goals !== void 0) {
            sets.push("goals = ?");
            updateParams.push(opts.goals);
          }
          sets.push("updated_at = datetime('now')");
          updateParams.push(m.id);
          db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...updateParams);
          if (opts.status === "archived") {
            db.prepare("DELETE FROM project_ports WHERE project_id = ?").run(m.id);
            db.prepare("DELETE FROM project_capabilities WHERE project_id = ?").run(m.id);
          }
        }
      });
      updateInTransaction();
      return { count: matched.length, projects: names, dry_run: false };
    } finally {
      db.close();
    }
  }
  // ── Ports ─────────────────────────────────────────────────────
  claimPort(projectName, serviceLabel, port, protocol = "tcp", claimedBy = "system") {
    const db = this.open();
    try {
      const project = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName);
      if (!project)
        throw new NotFoundError(projectName);
      let portNum;
      if (port !== void 0) {
        if (port < PORT_RANGE_MIN || port > PORT_RANGE_MAX) {
          throw new InvalidInputError(`Port ${port} is out of range (${PORT_RANGE_MIN}-${PORT_RANGE_MAX}).`);
        }
        const existing = db.prepare(`SELECT pp.port, p.name, pp.service_label FROM project_ports pp JOIN projects p ON p.id = pp.project_id WHERE pp.port = ?`).get(port);
        if (existing) {
          throw new InvalidInputError(`Port ${port} is already claimed by ${existing.name} (${existing.service_label}).`);
        }
        portNum = port;
      } else {
        portNum = this.autoAllocatePort(db);
      }
      db.prepare(`INSERT INTO project_ports (project_id, port, service_label, protocol, claimed_by) VALUES (?, ?, ?, ?, ?)`).run(project.id, portNum, serviceLabel, protocol, claimedBy);
      return portNum;
    } finally {
      db.close();
    }
  }
  releasePort(projectName, port) {
    const db = this.open();
    try {
      const project = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName);
      if (!project)
        return false;
      const result = db.prepare("DELETE FROM project_ports WHERE project_id = ? AND port = ?").run(project.id, port);
      return result.changes > 0;
    } finally {
      db.close();
    }
  }
  checkPort(port) {
    const db = this.open();
    try {
      const row = db.prepare(`SELECT pp.port, p.name as project, pp.service_label, pp.protocol
         FROM project_ports pp JOIN projects p ON p.id = pp.project_id
         WHERE pp.port = ?`).get(port);
      if (!row)
        return { available: true, port };
      return { available: false, port, project: row.project, service_label: row.service_label, protocol: row.protocol };
    } finally {
      db.close();
    }
  }
  listProjectPorts(projectName) {
    const db = this.open();
    try {
      const project = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName);
      if (!project)
        return [];
      return this.loadPorts(db, project.id);
    } finally {
      db.close();
    }
  }
  discoverPorts(projectName) {
    const db = this.open();
    try {
      const project = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName);
      if (!project)
        throw new NotFoundError(projectName);
      const pathRows = db.prepare("SELECT path FROM project_paths WHERE project_id = ?").all(project.id);
      if (pathRows.length === 0) {
        return { claimed: [], skipped: [], summary: "No filesystem paths registered for this project." };
      }
      const claimed = [];
      const skipped = [];
      for (const { path } of pathRows) {
        const discovered = discoverPortsInPath(path);
        for (const dp of discovered) {
          if (dp.port < PORT_RANGE_MIN || dp.port > PORT_RANGE_MAX) {
            skipped.push({ port: dp.port, reason: `Out of range (${PORT_RANGE_MIN}-${PORT_RANGE_MAX})` });
            continue;
          }
          const existing = db.prepare("SELECT pp.port, p.name FROM project_ports pp JOIN projects p ON p.id = pp.project_id WHERE pp.port = ?").get(dp.port);
          if (existing) {
            if (existing.name === projectName) {
              continue;
            }
            skipped.push({ port: dp.port, reason: `Already claimed by ${existing.name}` });
            continue;
          }
          db.prepare("INSERT INTO project_ports (project_id, port, service_label, protocol, claimed_by) VALUES (?, ?, ?, ?, ?)").run(project.id, dp.port, dp.service_label, "tcp", "discovery");
          claimed.push(dp);
        }
      }
      const summary = `Discovered ${claimed.length + skipped.length} port(s): ${claimed.length} claimed, ${skipped.length} skipped.`;
      return { claimed, skipped, summary };
    } finally {
      db.close();
    }
  }
  // ── Capabilities ──────────────────────────────────────────────
  registerCapabilities(projectName, capabilities, producer = "fctry") {
    const db = this.open();
    try {
      const project = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName);
      if (!project)
        throw new NotFoundError(projectName);
      const doReplace = db.transaction(() => {
        db.prepare("DELETE FROM project_capabilities WHERE project_id = ?").run(project.id);
        const insert = db.prepare(`
          INSERT INTO project_capabilities
          (project_id, name, capability_type, description, inputs, outputs, producer, requires_auth, invocation_model, audience)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cap of capabilities) {
          insert.run(project.id, cap.name, cap.capability_type, cap.description ?? "", cap.inputs ?? "", cap.outputs ?? "", producer, cap.requires_auth != null ? cap.requires_auth ? 1 : 0 : null, cap.invocation_model ?? "", cap.audience ?? "");
        }
      });
      doReplace();
      return capabilities.length;
    } finally {
      db.close();
    }
  }
  queryCapabilities(opts) {
    const db = this.open();
    try {
      let sql = `
        SELECT pc.*, p.name as project_name FROM project_capabilities pc
        JOIN projects p ON p.id = pc.project_id
      `;
      const conditions = [];
      const params = [];
      if (opts?.project_name) {
        conditions.push("p.name = ?");
        params.push(opts.project_name);
      }
      if (opts?.capability_type) {
        conditions.push("pc.capability_type = ?");
        params.push(opts.capability_type);
      }
      if (opts?.keyword) {
        const kw = `%${opts.keyword}%`;
        conditions.push("(pc.name LIKE ? OR pc.description LIKE ?)");
        params.push(kw, kw);
      }
      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY p.name, pc.name";
      const rows = db.prepare(sql).all(...params);
      return rows.map((row) => {
        const result = {
          project: row.project_name,
          name: row.name,
          type: row.capability_type,
          description: row.description
        };
        if (row.inputs)
          result.inputs = row.inputs;
        if (row.outputs)
          result.outputs = row.outputs;
        if (row.requires_auth != null)
          result.requires_auth = Boolean(row.requires_auth);
        if (row.invocation_model)
          result.invocation_model = row.invocation_model;
        if (row.audience)
          result.audience = row.audience;
        return result;
      });
    } finally {
      db.close();
    }
  }
  // ── Tasks ─────────────────────────────────────────────────────
  queueTask(opts) {
    const isFanOut = opts.type_filter || opts.status_filter;
    if (isFanOut) {
      if (!opts.type_filter && !opts.status_filter) {
        throw new InvalidInputError("Cross-project dispatch requires at least one filter.");
      }
      return this.dispatchTasks(opts);
    }
    const db = this.open();
    try {
      const result = db.prepare("INSERT INTO tasks (project_name, description, schedule) VALUES (?, ?, ?)").run(opts.project_name ?? null, opts.description, opts.schedule);
      return { task_id: Number(result.lastInsertRowid) };
    } finally {
      db.close();
    }
  }
  dispatchTasks(opts) {
    const db = this.open();
    try {
      let sql = "SELECT name FROM projects";
      const conditions = [];
      const params = [];
      if (opts.type_filter) {
        conditions.push("type = ?");
        params.push(opts.type_filter);
      }
      if (opts.status_filter) {
        conditions.push("status = ?");
        params.push(opts.status_filter);
      }
      sql += " WHERE " + conditions.join(" AND ");
      const projects = db.prepare(sql).all(...params);
      const names = projects.map((p) => p.name);
      const insert = db.prepare("INSERT INTO tasks (project_name, description, schedule) VALUES (?, ?, ?)");
      const doInsert = db.transaction(() => {
        for (const name of names) {
          insert.run(name, opts.description, opts.schedule);
        }
      });
      doInsert();
      return { count: names.length, projects: names };
    } finally {
      db.close();
    }
  }
  listTasks(opts) {
    const db = this.open();
    try {
      let sql = "SELECT * FROM tasks";
      const conditions = [];
      const params = [];
      if (opts?.status_filter) {
        conditions.push("status = ?");
        params.push(opts.status_filter);
      }
      if (opts?.project_name) {
        conditions.push("project_name = ?");
        params.push(opts.project_name);
      }
      if (conditions.length > 0)
        sql += " WHERE " + conditions.join(" AND ");
      sql += " ORDER BY created_at DESC";
      return db.prepare(sql).all(...params);
    } finally {
      db.close();
    }
  }
  // ── Internal helpers ──────────────────────────────────────────
  loadRecord(db, opts) {
    let row;
    if (opts.name) {
      row = db.prepare("SELECT * FROM projects WHERE name = ?").get(opts.name);
    } else if (opts.projectId) {
      row = db.prepare("SELECT * FROM projects WHERE id = ?").get(opts.projectId);
    }
    if (!row)
      return null;
    return this.rowToRecord(db, row);
  }
  rowToRecord(db, row) {
    const id = row.id;
    const pathRows = db.prepare("SELECT path FROM project_paths WHERE project_id = ? ORDER BY path").all(id);
    const paths = pathRows.map((r) => r.path);
    const fieldRows = db.prepare("SELECT field_name, field_value, producer FROM project_fields WHERE project_id = ?").all(id);
    const extended_fields = {};
    const field_producers = {};
    for (const f of fieldRows) {
      extended_fields[f.field_name] = f.field_value;
      field_producers[f.field_name] = f.producer;
    }
    const capRows = db.prepare("SELECT * FROM project_capabilities WHERE project_id = ?").all(id);
    const capabilities = capRows.map((c) => ({
      name: c.name,
      capability_type: c.capability_type,
      description: c.description,
      inputs: c.inputs || void 0,
      outputs: c.outputs || void 0,
      requires_auth: c.requires_auth != null ? Boolean(c.requires_auth) : null,
      invocation_model: c.invocation_model || void 0,
      audience: c.audience || void 0
    }));
    return {
      id,
      name: row.name,
      display_name: row.display_name,
      type: row.type,
      status: row.status,
      description: row.description,
      goals: row.goals,
      topics: row.topics || "[]",
      entities: row.entities || "[]",
      concerns: row.concerns || "[]",
      paths,
      extended_fields,
      field_producers,
      capabilities,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  formatRecord(db, record, depth) {
    switch (depth) {
      case "minimal":
        return { name: record.name, type: record.type, status: record.status };
      case "summary":
        return toSummary(record);
      case "standard": {
        const templateFields = getTemplateFields(db, record.type);
        return toStandard(record, templateFields);
      }
      case "full":
        return toFull(record);
      default:
        return toSummary(record);
    }
  }
  loadPorts(db, projectId) {
    const rows = db.prepare("SELECT port, service_label, protocol, claimed_at FROM project_ports WHERE project_id = ? ORDER BY port").all(projectId);
    return rows;
  }
  autoAllocatePort(db) {
    const claimed = db.prepare("SELECT port FROM project_ports ORDER BY port").all();
    const claimedSet = new Set(claimed.map((r) => r.port));
    for (let p = PORT_RANGE_MIN; p <= PORT_RANGE_MAX; p++) {
      if (!claimedSet.has(p))
        return p;
    }
    throw new InvalidInputError("No available ports in range 3000-9999.");
  }
}
const CONTRADICTION_TYPES = /* @__PURE__ */ new Set(["preference", "correction", "learning"]);
const CORRECTION_MIN_IMPORTANCE = 0.9;
const EMA_ALPHA = 0.1;
function newId$1() {
  return randomUUID().replace(/-/g, "");
}
function nowIso$1() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function normalizeContent(content) {
  return content.trim().replace(/\s+/g, " ");
}
function contentHash(memoryType, normalizedContent) {
  const payload = `${memoryType}:${normalizedContent}`;
  return createHash("sha256").update(payload, "utf-8").digest("hex").slice(0, 16);
}
class MemoryStore {
  _dbPath;
  constructor(dbPath) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }
  open() {
    return connect(this._dbPath);
  }
  // ── Retain ────────────────────────────────────────────────
  retain(opts) {
    if (!MEMORY_TYPES.has(opts.type)) {
      throw new InvalidInputError(`Unknown memory type '${opts.type}'. Allowed: ${[...MEMORY_TYPES].join(", ")}`);
    }
    const normalized = normalizeContent(opts.content);
    const hash = contentHash(opts.type, normalized);
    const now = nowIso$1();
    const scope = opts.scope ?? (opts.project_id ? "project" : "global");
    if (opts.scope && !MEMORY_SCOPES.has(opts.scope)) {
      throw new InvalidInputError(`Unknown scope '${opts.scope}'. Allowed: ${[...MEMORY_SCOPES].join(", ")}`);
    }
    if (opts.belief != null && !MEMORY_BELIEFS.has(opts.belief)) {
      throw new InvalidInputError(`Unknown belief '${opts.belief}'. Allowed: ${[...MEMORY_BELIEFS].join(", ")}`);
    }
    if (opts.entities != null) {
      if (!Array.isArray(opts.entities)) {
        throw new InvalidInputError("Entities must be an array");
      }
      for (const e of opts.entities) {
        if (!e.name || typeof e.name !== "string" || !e.type || typeof e.type !== "string") {
          throw new InvalidInputError("Each entity must have a name (string) and type (string)");
        }
      }
    }
    const isPinned = opts.type === "context" ? false : opts.is_pinned ?? false;
    if (opts.parent_version_id != null && opts.type !== "procedural") {
      throw new InvalidInputError("parent_version_id is only valid for procedural type memories");
    }
    let importance = opts.importance ?? 0.5;
    if (opts.type === "correction" && importance < CORRECTION_MIN_IMPORTANCE) {
      importance = CORRECTION_MIN_IMPORTANCE;
    }
    const db = this.open();
    try {
      let existing;
      if (opts.project_id == null) {
        existing = db.prepare(`SELECT id, reinforcement_count FROM memories WHERE content_hash = ? AND project_id IS NULL AND scope = ? AND status = 'active'`).get(hash, scope);
      } else {
        existing = db.prepare(`SELECT id, reinforcement_count FROM memories WHERE content_hash = ? AND project_id = ? AND scope = ? AND status = 'active'`).get(hash, opts.project_id, scope);
      }
      if (existing) {
        const newCount = existing.reinforcement_count + 1;
        db.prepare(`UPDATE memories SET reinforcement_count = ?, updated_at = ? WHERE id = ?`).run(newCount, now, existing.id);
        return { memory_id: existing.id, is_new: false, reinforcement_count: newCount };
      }
      let potentialConflicts;
      if (CONTRADICTION_TYPES.has(opts.type)) {
        potentialConflicts = this.detectConflicts(db, opts.content, opts.type, opts.project_id ?? null, scope);
      }
      const memoryId = newId$1();
      const tagsStr = opts.tags ? JSON.stringify(opts.tags) : null;
      const entitiesStr = opts.entities ? JSON.stringify(opts.entities) : null;
      if (opts.parent_version_id != null) {
        const parent = db.prepare("SELECT id, type, is_current FROM memories WHERE id = ? AND status = ?").get(opts.parent_version_id, "active");
        if (!parent) {
          throw new NotFoundError(`Parent memory '${opts.parent_version_id}' not found or not active`);
        }
        if (parent.type !== "procedural") {
          throw new InvalidInputError(`Parent memory '${opts.parent_version_id}' is type '${parent.type}', not 'procedural'`);
        }
        db.prepare("UPDATE memories SET is_current = 0, updated_at = ? WHERE id = ?").run(now, opts.parent_version_id);
      }
      db.prepare(`
        INSERT INTO memories (
          id, content, type, importance, confidence, status,
          project_id, scope, agent_role, session_id, tags,
          content_hash, reinforcement_count, outcome_score,
          is_static, is_inference, is_pinned,
          belief, extraction_confidence, valid_from, valid_until, entities,
          parent_version_id, is_current,
          created_at, updated_at, forget_after
        ) VALUES (?, ?, ?, ?, 0.5, 'active', ?, ?, ?, ?, ?, ?, 1, 0.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(memoryId, opts.content, opts.type, importance, opts.project_id ?? null, scope, opts.agent_role ?? null, opts.session_id ?? null, tagsStr, hash, opts.is_static ? 1 : 0, opts.is_inference ? 1 : 0, isPinned ? 1 : 0, opts.belief ?? null, opts.extraction_confidence ?? null, opts.valid_from ?? null, opts.valid_until ?? null, entitiesStr, opts.parent_version_id ?? null, now, now, opts.forget_after ?? null);
      const versionId = newId$1();
      db.prepare(`
        INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
        VALUES (?, ?, NULL, 'system', 'created', ?)
      `).run(versionId, memoryId, now);
      if (opts.session_id || opts.agent_role) {
        const sourceId = newId$1();
        db.prepare(`
          INSERT INTO memory_sources (id, memory_id, project_id, session_id, agent_role, context_snippet, timestamp)
          VALUES (?, ?, ?, ?, ?, NULL, ?)
        `).run(sourceId, memoryId, opts.project_id ?? null, opts.session_id ?? null, opts.agent_role ?? null, now);
      }
      const result = {
        memory_id: memoryId,
        is_new: true,
        reinforcement_count: 1
      };
      if (potentialConflicts && potentialConflicts.length > 0) {
        result.potential_conflicts = potentialConflicts;
      }
      return result;
    } finally {
      db.close();
    }
  }
  // ── Conflict Detection ───────────────────────────────────
  detectConflicts(db, content, type, projectId, scope) {
    const words = content.replace(/[*"(){}[\]^~\\:]/g, " ").replace(/\b(AND|OR|NOT|NEAR)\b/gi, "").trim().split(/\s+/).filter((t) => t.length > 2);
    if (words.length === 0)
      return [];
    const queryTerms = words.slice(0, 5).map((t) => `"${t}"`).join(" OR ");
    try {
      let sql;
      const params = [queryTerms];
      if (projectId) {
        sql = `
          SELECT m.id, m.content, m.type, m.content_hash
          FROM memory_fts fts
          JOIN memories m ON m.id = fts.memory_id
          WHERE memory_fts MATCH ?
            AND m.status = 'active'
            AND m.type = ?
            AND (m.project_id = ? OR m.scope IN ('portfolio', 'global'))
          ORDER BY fts.rank
          LIMIT 5
        `;
        params.push(type, projectId);
      } else {
        sql = `
          SELECT m.id, m.content, m.type, m.content_hash
          FROM memory_fts fts
          JOIN memories m ON m.id = fts.memory_id
          WHERE memory_fts MATCH ?
            AND m.status = 'active'
            AND m.type = ?
            AND m.scope = ?
          ORDER BY fts.rank
          LIMIT 5
        `;
        params.push(type, scope);
      }
      const rows = db.prepare(sql).all(...params);
      const newHash = contentHash(type, normalizeContent(content));
      return rows.filter((r) => r.content_hash !== newHash).map((r) => ({ id: r.id, content: r.content, type: r.type }));
    } catch {
      return [];
    }
  }
  // ── Feedback ──────────────────────────────────────────────
  feedback(opts) {
    const signal = opts.outcome === "success" ? 1 : 0;
    const now = nowIso$1();
    const updatedIds = [];
    const newScores = {};
    const db = this.open();
    try {
      const doFeedback = db.transaction(() => {
        for (const mid of opts.memory_ids) {
          const row = db.prepare("SELECT id, outcome_score FROM memories WHERE id = ?").get(mid);
          if (!row)
            continue;
          const newScore = row.outcome_score + EMA_ALPHA * (signal - row.outcome_score);
          db.prepare("UPDATE memories SET outcome_score = ?, updated_at = ? WHERE id = ?").run(newScore, now, mid);
          const versionId = newId$1();
          db.prepare(`
            INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
            VALUES (?, ?, NULL, 'system', 'updated', ?)
          `).run(versionId, mid, now);
          updatedIds.push(mid);
          newScores[mid] = newScore;
        }
      });
      doFeedback();
      return { updated_count: updatedIds.length, memory_ids: updatedIds, new_scores: newScores };
    } finally {
      db.close();
    }
  }
  // ── Correct ───────────────────────────────────────────────
  correct(opts) {
    const now = nowIso$1();
    const db = this.open();
    try {
      const original = db.prepare("SELECT * FROM memories WHERE id = ?").get(opts.memory_id);
      if (!original)
        throw new NotFoundError(opts.memory_id);
      const normalized = normalizeContent(opts.new_content);
      const hash = contentHash("correction", normalized);
      const existingCorrection = db.prepare(`SELECT id, reinforcement_count FROM memories WHERE content_hash = ? AND project_id IS ? AND scope = ? AND status = 'active'`).get(hash, original.project_id, original.scope);
      let correctionId;
      if (existingCorrection) {
        correctionId = existingCorrection.id;
        db.prepare("UPDATE memories SET reinforcement_count = ?, updated_at = ? WHERE id = ?").run(existingCorrection.reinforcement_count + 1, now, correctionId);
      } else {
        correctionId = newId$1();
        const tagsStr = original.tags;
        db.prepare(`
          INSERT INTO memories (
            id, content, type, importance, confidence, status,
            project_id, scope, agent_role, session_id, tags,
            content_hash, reinforcement_count, outcome_score,
            is_static, is_inference, is_pinned,
            created_at, updated_at
          ) VALUES (?, ?, 'correction', ?, 0.5, 'active', ?, ?, ?, ?, ?, ?, 1, 0.0, ?, 0, 0, ?, ?)
        `).run(correctionId, opts.new_content, CORRECTION_MIN_IMPORTANCE, original.project_id, original.scope, opts.agent_role ?? null, opts.session_id ?? null, tagsStr, hash, original.is_static, now, now);
        const versionId = newId$1();
        db.prepare(`
          INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
          VALUES (?, ?, NULL, 'system', 'created', ?)
        `).run(versionId, correctionId, now);
      }
      db.prepare("UPDATE memories SET status = 'superseded', updated_at = ? WHERE id = ?").run(now, opts.memory_id);
      const archiveVersionId = newId$1();
      db.prepare(`
        INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
        VALUES (?, ?, ?, 'system', 'superseded', ?)
      `).run(archiveVersionId, opts.memory_id, original.content, now);
      const edgeId = newId$1();
      db.prepare(`
        INSERT INTO memory_edges (id, source_id, target_id, relationship_type, weight, confidence, observation_count, created_at)
        VALUES (?, ?, ?, 'contradicts', 1.0, 1.0, 1, ?)
      `).run(edgeId, correctionId, opts.memory_id, now);
      return { correction_id: correctionId, superseded_id: opts.memory_id, edge_id: edgeId };
    } finally {
      db.close();
    }
  }
  // ── Forget ────────────────────────────────────────────────
  forget(opts) {
    const now = nowIso$1();
    const db = this.open();
    try {
      const row = db.prepare("SELECT id, content FROM memories WHERE id = ?").get(opts.memory_id);
      if (!row)
        throw new NotFoundError(opts.memory_id);
      db.prepare("UPDATE memories SET status = 'archived', forget_reason = ?, updated_at = ? WHERE id = ?").run(opts.reason, now, opts.memory_id);
      const versionId = newId$1();
      db.prepare(`
        INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
        VALUES (?, ?, ?, 'system', 'archived', ?)
      `).run(versionId, opts.memory_id, row.content, now);
      return { memory_id: opts.memory_id, status: "archived" };
    } finally {
      db.close();
    }
  }
  // ── Inspect ───────────────────────────────────────────────
  inspectMemory(memoryId) {
    const db = this.open();
    try {
      const memory = db.prepare("SELECT * FROM memories WHERE id = ?").get(memoryId);
      if (!memory)
        throw new NotFoundError(memoryId);
      if (memory.tags && typeof memory.tags === "string") {
        try {
          memory.tags = JSON.parse(memory.tags);
        } catch {
        }
      }
      memory.is_static = Boolean(memory.is_static);
      memory.is_inference = Boolean(memory.is_inference);
      memory.is_pinned = Boolean(memory.is_pinned);
      const versions = db.prepare("SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY timestamp").all(memoryId);
      const edges = db.prepare("SELECT * FROM memory_edges WHERE source_id = ? OR target_id = ? ORDER BY created_at").all(memoryId, memoryId);
      const sources = db.prepare("SELECT * FROM memory_sources WHERE memory_id = ? ORDER BY timestamp").all(memoryId);
      const enrichment = db.prepare("SELECT * FROM enrichment_log WHERE memory_id = ? ORDER BY created_at").all(memoryId);
      return { memory, versions, edges, sources, enrichment_log: enrichment };
    } finally {
      db.close();
    }
  }
  // ── Status ────────────────────────────────────────────────
  memoryStatus(projectId) {
    const db = this.open();
    try {
      let typeCondition = "";
      const typeParams = [];
      if (projectId) {
        typeCondition = " WHERE project_id = ?";
        typeParams.push(projectId);
      }
      const countsByType = db.prepare(`SELECT type, COUNT(*) as count FROM memories${typeCondition} GROUP BY type`).all(...typeParams);
      const countsByStatus = db.prepare(`SELECT status, COUNT(*) as count FROM memories${typeCondition} GROUP BY status`).all(...typeParams);
      const totalRow = db.prepare(`SELECT COUNT(*) as count FROM memories${typeCondition}`).get(...typeParams);
      const byType = {};
      for (const r of countsByType)
        byType[r.type] = r.count;
      const byStatus = {};
      for (const r of countsByStatus)
        byStatus[r.status] = r.count;
      const lastRetain = db.prepare(`SELECT MAX(created_at) as ts FROM memories${typeCondition}`).get(...typeParams);
      const lastRecall = db.prepare("SELECT MAX(timestamp) as ts FROM recall_audit").get();
      const providerRow = db.prepare("SELECT value FROM schema_meta WHERE key = 'embedding_provider'").get();
      return {
        counts_by_type: byType,
        counts_by_status: byStatus,
        total: totalRow.count,
        temporal: {
          last_retain: lastRetain.ts,
          last_recall: lastRecall.ts
        },
        embedding_provider: providerRow?.value ?? "none"
      };
    } finally {
      db.close();
    }
  }
  // ── Configure ─────────────────────────────────────────────
  configureMemory(opts) {
    const db = this.open();
    try {
      const upsert = db.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)");
      if (opts.embedding_provider !== void 0) {
        upsert.run("embedding_provider", opts.embedding_provider);
      }
      if (opts.reflect_schedule !== void 0) {
        upsert.run("reflect_schedule", opts.reflect_schedule);
      }
      if (opts.reflect_threshold !== void 0) {
        upsert.run("reflect_threshold", String(opts.reflect_threshold));
      }
      const rows = db.prepare("SELECT key, value FROM schema_meta WHERE key IN ('embedding_provider', 'reflect_schedule', 'reflect_threshold')").all();
      const config = {};
      for (const r of rows)
        config[r.key] = r.value;
      return config;
    } finally {
      db.close();
    }
  }
}
function newId() {
  return randomUUID().replace(/-/g, "");
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function sanitizeFtsQuery(query) {
  return query.replace(/[*"(){}[\]^~\\:]/g, " ").replace(/\b(AND|OR|NOT|NEAR)\b/gi, "").trim().split(/\s+/).filter((t) => t.length > 0).map((t) => `"${t}"`).join(" OR ");
}
const TEMPORAL_PATTERNS = /\b(recent|latest|last|today|yesterday|this week|this month|when|since|ago|new|updated|changed)\b/i;
const FACTUAL_PATTERNS = /\b(what is|what are|how does|how do|define|exactly|specific|which|where is|does it|is there)\b/i;
const RELATIONAL_PATTERNS = /\b(who|between|relationship|related|connected|depends|dependency|linked|affects|impacts|uses|used by)\b/i;
function classifyIntent(query) {
  const temporal = TEMPORAL_PATTERNS.test(query);
  const factual = FACTUAL_PATTERNS.test(query);
  const relational = RELATIONAL_PATTERNS.test(query);
  if (relational && !temporal && !factual)
    return "relational";
  if (temporal && !factual)
    return "temporal";
  if (factual && !temporal)
    return "factual";
  return "exploratory";
}
const INTENT_WEIGHTS = {
  temporal: { relevance: 0.6, recency: 1.5, reinforcement: 0.1, outcome: 0.2 },
  factual: { relevance: 1.5, recency: 0.5, reinforcement: 0.1, outcome: 0.2 },
  relational: { relevance: 1, recency: 0.8, reinforcement: 0.3, outcome: 0.2 },
  exploratory: { relevance: 1, recency: 1, reinforcement: 0.1, outcome: 0.2 }
};
class MemoryRetrieval {
  _dbPath;
  constructor(dbPath) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }
  open() {
    return connect(this._dbPath);
  }
  /**
   * Recall memories matching a query with budget control.
   * If no query is provided, runs bootstrap mode (returns project memory profile).
   */
  recall(opts) {
    const db = this.open();
    try {
      const isBootstrap = !opts.query;
      const budget = opts.token_budget ?? 4e3;
      let candidates;
      if (isBootstrap) {
        candidates = this.bootstrapRecall(db, opts.project_id);
      } else {
        candidates = this.searchRecall(db, opts.query, opts.project_id);
      }
      const charsPerToken = 4;
      let usedTokens = 0;
      const results = [];
      const tierBuckets = MemoryRetrieval.TYPE_TIERS.map(() => []);
      const uncategorized = [];
      for (const mem of candidates) {
        const tierIdx = MemoryRetrieval.TYPE_TIERS.findIndex((t) => t.includes(mem.type));
        if (tierIdx >= 0)
          tierBuckets[tierIdx].push(mem);
        else
          uncategorized.push(mem);
      }
      for (const bucket of [...tierBuckets, uncategorized]) {
        for (const mem of bucket) {
          const fullLen = mem.content.length;
          const l0Len = mem.content_l0?.length ?? fullLen;
          const tokensNeeded = Math.ceil(Math.min(l0Len, fullLen) / charsPerToken);
          if (usedTokens + tokensNeeded > budget && results.length > 0)
            break;
          results.push(mem);
          usedTokens += Math.ceil(fullLen / charsPerToken);
        }
        if (usedTokens >= budget)
          break;
      }
      this.logRecall(db, opts.query ?? null, isBootstrap ? "bootstrap" : "search", budget, opts.project_id ?? null, results);
      return results;
    } finally {
      db.close();
    }
  }
  bootstrapRecall(db, projectId) {
    let sql = `
      SELECT * FROM memories WHERE status = 'active'
      AND (type != 'procedural' OR is_current = 1)
    `;
    const params = [];
    if (projectId) {
      sql += ` AND (project_id = ? OR scope IN ('portfolio', 'global'))`;
      params.push(projectId);
    }
    sql += ` ORDER BY is_pinned DESC, importance DESC, reinforcement_count DESC, updated_at DESC LIMIT 50`;
    const rows = db.prepare(sql).all(...params);
    return rows.map((r, idx) => this.rowToResult(r, 1 - idx * 0.01));
  }
  searchRecall(db, query, projectId) {
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized)
      return [];
    const intent = classifyIntent(query);
    const ftsResults = this.ftsSearch(db, sanitized, projectId);
    return this.scoreAndRank(ftsResults, intent);
  }
  ftsSearch(db, ftsQuery, projectId) {
    try {
      let sql;
      const params = [];
      if (projectId) {
        sql = `
          SELECT m.*, fts.rank
          FROM memory_fts fts
          JOIN memories m ON m.id = fts.memory_id
          WHERE memory_fts MATCH ?
            AND m.status = 'active'
            AND (m.type != 'procedural' OR m.is_current = 1)
            AND (m.project_id = ? OR m.scope IN ('portfolio', 'global'))
          ORDER BY fts.rank
          LIMIT 50
        `;
        params.push(ftsQuery, projectId);
      } else {
        sql = `
          SELECT m.*, fts.rank
          FROM memory_fts fts
          JOIN memories m ON m.id = fts.memory_id
          WHERE memory_fts MATCH ?
            AND m.status = 'active'
            AND (m.type != 'procedural' OR m.is_current = 1)
          ORDER BY fts.rank
          LIMIT 50
        `;
        params.push(ftsQuery);
      }
      const rows = db.prepare(sql).all(...params);
      return rows.map((r, idx) => this.rowToResult(r, 1 / (idx + 1)));
    } catch {
      return this.likeSearch(db, ftsQuery, projectId);
    }
  }
  likeSearch(db, query, projectId) {
    const likeQ = `%${query.replace(/"/g, "")}%`;
    let sql = `
      SELECT * FROM memories
      WHERE status = 'active'
      AND (type != 'procedural' OR is_current = 1)
      AND (content LIKE ? OR content_l0 LIKE ?)
    `;
    const params = [likeQ, likeQ];
    if (projectId) {
      sql += ` AND (project_id = ? OR scope IN ('portfolio', 'global'))`;
      params.push(projectId);
    }
    sql += " ORDER BY importance DESC LIMIT 50";
    const rows = db.prepare(sql).all(...params);
    return rows.map((r, idx) => this.rowToResult(r, 0.5 / (idx + 1)));
  }
  // Type-priority tiers for budget allocation (spec §3.3):
  // Fill results in tier order; within each tier, sort by composite score.
  static TYPE_TIERS = [
    ["correction", "preference"],
    ["outcome", "learning"],
    ["pattern", "procedural"],
    ["decision", "dependency", "observation"],
    ["context"]
  ];
  // Per-type decay rate multipliers (spec §2.12): lower = slower decay
  static DECAY_RATES = {
    correction: 0.25,
    preference: 0.25,
    procedural: 0.5,
    observation: 0.5,
    decision: 1,
    dependency: 1,
    learning: 1,
    outcome: 1.5,
    pattern: 1.5,
    context: 2
  };
  scoreAndRank(results, intent = "exploratory") {
    const weights = INTENT_WEIGHTS[intent];
    for (const r of results) {
      const reinforcementBoost = Math.log(r.reinforcement_count + 1);
      const outcomeBoost = r.outcome_score * weights.outcome;
      const pinnedBoost = r.is_pinned ? 10 : 0;
      const decayRate = MemoryRetrieval.DECAY_RATES[r.type] ?? 1;
      const daysSinceUpdate = (Date.now() - new Date(r.updated_at).getTime()) / (1e3 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-(daysSinceUpdate * decayRate) / 30);
      let temporalPenalty = 0;
      if (r.valid_until) {
        const expiryMs = new Date(r.valid_until).getTime();
        if (expiryMs < Date.now()) {
          temporalPenalty = -0.3;
        }
      }
      r.relevance_score = r.relevance_score * weights.relevance + reinforcementBoost * weights.reinforcement + outcomeBoost + pinnedBoost + recencyFactor * weights.recency + temporalPenalty;
    }
    results.sort((a, b) => b.relevance_score - a.relevance_score);
    const clipped = [];
    for (let i = 0; i < results.length; i++) {
      clipped.push(results[i]);
      if (i > 0 && i < results.length - 1) {
        const ratio = results[i + 1].relevance_score / results[i].relevance_score;
        if (ratio < 0.3 && clipped.length >= 3)
          break;
      }
    }
    return clipped;
  }
  rowToResult(row, baseScore) {
    return {
      id: row.id,
      content: row.content,
      content_l0: row.content_l0,
      content_l1: row.content_l1,
      type: row.type,
      scope: row.scope,
      importance: row.importance,
      reinforcement_count: row.reinforcement_count,
      outcome_score: row.outcome_score,
      is_pinned: Boolean(row.is_pinned),
      relevance_score: baseScore,
      project_id: row.project_id,
      belief: row.belief,
      extraction_confidence: row.extraction_confidence,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      entities: row.entities,
      parent_version_id: row.parent_version_id,
      is_current: row.is_current == null ? true : Boolean(row.is_current),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  logRecall(db, query, mode, budget, projectId, results) {
    const auditId = newId();
    const memoryIds = JSON.stringify(results.map((r) => r.id));
    const scores = JSON.stringify(results.map((r) => ({ id: r.id, score: r.relevance_score })));
    db.prepare(`
      INSERT INTO recall_audit (id, query, mode, budget_tokens, scope, project_id, memory_ids_returned, scores, timestamp)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `).run(auditId, query, mode, budget, projectId, memoryIds, scores, nowIso());
  }
}
join(homedir(), ".claude", "projects");
join(homedir(), ".fctry", "memory.md");
class BootstrapNotConfiguredError extends RegistryError {
  constructor() {
    super("BOOTSTRAP_NOT_CONFIGURED", "Bootstrap is not configured.", "Call configure_bootstrap first to set path roots for your project types and a template directory.");
    this.name = "BootstrapNotConfiguredError";
  }
}
class BootstrapFolderExistsError extends RegistryError {
  constructor(path) {
    super("FOLDER_EXISTS", `The folder '${path}' already exists.`, "Choose a different name, provide a path_override to a different location, or remove the existing folder manually.");
    this.name = "BootstrapFolderExistsError";
  }
}
class Bootstrap {
  _dbPath;
  constructor(dbPath) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }
  open() {
    return connect(this._dbPath);
  }
  configureBootstrap(opts) {
    const db = this.open();
    try {
      const upsert = db.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)");
      if (opts.path_roots !== void 0) {
        for (const [type, path] of Object.entries(opts.path_roots)) {
          if (type !== "project" && type !== "non_code_project" && type !== "area_of_focus") {
            throw new RegistryError("INVALID_INPUT", `Invalid project type '${type}' in path_roots. Must be 'project', 'non_code_project', or 'area_of_focus'.`);
          }
          upsert.run(`bootstrap_path_root_${type}`, path);
        }
      }
      if (opts.archive_path_root !== void 0) {
        upsert.run("bootstrap_archive_path_root", opts.archive_path_root);
      }
      if (opts.template_dir !== void 0) {
        if (!existsSync(opts.template_dir)) {
          throw new RegistryError("INVALID_INPUT", `Template directory '${opts.template_dir}' does not exist.`);
        }
        upsert.run("bootstrap_template_dir", opts.template_dir);
      }
      return this._getConfig(db);
    } finally {
      db.close();
    }
  }
  getConfig() {
    const db = this.open();
    try {
      return this._getConfig(db);
    } finally {
      db.close();
    }
  }
  _getConfig(db) {
    const rows = db.prepare("SELECT key, value FROM schema_meta WHERE key LIKE 'bootstrap_%'").all();
    const config = { path_roots: {} };
    for (const row of rows) {
      if (row.key === "bootstrap_template_dir") {
        config.template_dir = row.value;
      } else if (row.key === "bootstrap_archive_path_root") {
        config.archive_path_root = row.value;
      } else if (row.key.startsWith("bootstrap_path_root_")) {
        const type = row.key.replace("bootstrap_path_root_", "");
        config.path_roots[type] = row.value;
      }
    }
    return config;
  }
  bootstrapProject(opts) {
    const db = this.open();
    try {
      const config = this._getConfig(db);
      if (Object.keys(config.path_roots).length === 0) {
        throw new BootstrapNotConfiguredError();
      }
      let targetPath;
      if (opts.path_override) {
        targetPath = opts.path_override;
      } else {
        const root = config.path_roots[opts.type];
        if (!root) {
          throw new RegistryError("BOOTSTRAP_NOT_CONFIGURED", `No path root configured for type '${opts.type}'.`, `Call configure_bootstrap to set a path root for '${opts.type}'.`);
        }
        targetPath = join(root, opts.name);
      }
      if (existsSync(targetPath)) {
        throw new BootstrapFolderExistsError(targetPath);
      }
      const registry2 = new Registry(this._dbPath);
      const existing = registry2.getProject(opts.name);
      if (existing) {
        throw new RegistryError("DUPLICATE", `A project named '${opts.name}' is already registered.`, `Use update_project() to modify it, or choose a different name.`);
      }
      mkdirSync(targetPath, { recursive: true });
      let templatesApplied = false;
      let gitInitialized = false;
      try {
        if (config.template_dir && existsSync(config.template_dir)) {
          const templateSubdir = this._resolveTemplateSubdir(config.template_dir, opts.type);
          if (templateSubdir && existsSync(templateSubdir)) {
            cpSync(templateSubdir, targetPath, { recursive: true });
            templatesApplied = true;
          }
        }
        if (opts.type === "project" && !opts.skip_git) {
          execSync("git init -q", { cwd: targetPath, stdio: "pipe" });
          execSync("git add .", { cwd: targetPath, stdio: "pipe" });
          execSync('git commit -q -m "Initial project scaffold from bootstrap_project" --allow-empty', {
            cwd: targetPath,
            stdio: "pipe"
          });
          gitInitialized = true;
        }
        registry2.register({
          name: opts.name,
          type: opts.type,
          status: opts.status ?? "active",
          description: opts.description ?? "",
          goals: opts.goals ?? "",
          display_name: opts.display_name,
          paths: [targetPath],
          producer: opts.producer ?? "bootstrap"
        });
      } catch (err) {
        try {
          rmSync(targetPath, { recursive: true, force: true });
        } catch {
        }
        throw err;
      }
      return {
        name: opts.name,
        path: targetPath,
        type: opts.type,
        git_initialized: gitInitialized,
        templates_applied: templatesApplied
      };
    } finally {
      db.close();
    }
  }
  /**
   * Archive a project: set status, release ports/caps, and optionally move folders
   * to the archive path root (stripping .git before moving).
   */
  archiveProject(name) {
    const registry2 = new Registry(this._dbPath);
    const result = registry2.archiveProject(name);
    const config = this.getConfig();
    const folders_moved = [];
    if (!config.archive_path_root) {
      return { ...result, folders_moved };
    }
    const project = registry2.getProject(name, "standard");
    const paths = project?.paths;
    if (!paths || paths.length === 0) {
      return { ...result, folders_moved };
    }
    const archiveRoot = config.archive_path_root;
    if (!existsSync(archiveRoot)) {
      mkdirSync(archiveRoot, { recursive: true });
    }
    const db = this.open();
    try {
      const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(name);
      if (!projectRow)
        return { ...result, folders_moved };
      for (const srcPath of paths) {
        if (!existsSync(srcPath))
          continue;
        const folderName = srcPath.split("/").pop();
        const destPath = join(archiveRoot, folderName);
        const gitDir = join(srcPath, ".git");
        if (existsSync(gitDir)) {
          rmSync(gitDir, { recursive: true, force: true });
        }
        const gitModules = join(srcPath, ".gitmodules");
        if (existsSync(gitModules)) {
          rmSync(gitModules, { force: true });
        }
        try {
          renameSync(srcPath, destPath);
        } catch {
          cpSync(srcPath, destPath, { recursive: true });
          rmSync(srcPath, { recursive: true, force: true });
        }
        db.prepare("UPDATE project_paths SET path = ? WHERE project_id = ? AND path = ?").run(destPath, projectRow.id, srcPath);
        folders_moved.push(destPath);
      }
    } finally {
      db.close();
    }
    return { ...result, folders_moved };
  }
  _resolveTemplateSubdir(templateDir, type) {
    const typeMap = {
      project: ["code-repo", "project", "code_project"],
      area_of_focus: ["area-of-focus", "area_of_focus", "area"]
    };
    const candidates = typeMap[type] ?? [];
    for (const candidate of candidates) {
      const subdir = join(templateDir, candidate);
      if (existsSync(subdir) && statSync(subdir).isDirectory()) {
        return subdir;
      }
    }
    const entries = readdirSync(templateDir);
    if (entries.length > 0) {
      return templateDir;
    }
    return null;
  }
}
let registry = null;
function getRegistry() {
  if (!registry) registry = new Registry();
  return registry;
}
function registerIpcHandlers(ipcMain2) {
  const reg = getRegistry();
  ipcMain2.handle("listProjects", (_e, opts) => {
    return reg.listProjects(opts);
  });
  ipcMain2.handle("getProject", (_e, name, depth) => {
    return reg.getProject(name, depth);
  });
  ipcMain2.handle("searchProjects", (_e, opts) => {
    return reg.searchProjects(opts);
  });
  ipcMain2.handle("getRegistryStats", () => {
    return reg.getRegistryStats();
  });
  ipcMain2.handle("register", (_e, opts) => {
    return reg.register(opts);
  });
  ipcMain2.handle("updateCore", (_e, name, updates) => {
    reg.updateCore(name, updates);
    return reg.getProject(name, "standard");
  });
  ipcMain2.handle("updateFields", (_e, name, fields, producer) => {
    reg.updateFields(name, fields, producer ?? "setlist-app");
  });
  ipcMain2.handle("archiveProject", (_e, name) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.archiveProject(name);
  });
  ipcMain2.handle("renameProject", (_e, oldName, newName) => {
    reg.renameProject(oldName, newName);
  });
  ipcMain2.handle("enrichProject", (_e, name, profile) => {
    return reg.enrichProject(name, profile);
  });
  ipcMain2.handle("listProjectPorts", (_e, projectName) => {
    return reg.listProjectPorts(projectName);
  });
  ipcMain2.handle("queryCapabilities", (_e, opts) => {
    return reg.queryCapabilities(opts);
  });
  ipcMain2.handle("recallMemories", (_e, opts) => {
    const retrieval = new MemoryRetrieval(reg.dbPath);
    return retrieval.recall({
      query: opts.query,
      project: opts.project,
      token_budget: opts.token_budget ?? 4e3
    });
  });
  ipcMain2.handle("memoryStatus", (_e, projectId) => {
    const store = new MemoryStore(reg.dbPath);
    return store.memoryStatus(projectId);
  });
  ipcMain2.handle("getBootstrapConfig", () => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.getConfig();
  });
  ipcMain2.handle("configureBootstrap", (_e, opts) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.configureBootstrap(opts);
  });
  ipcMain2.handle("bootstrapProject", (_e, opts) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.bootstrapProject({
      ...opts,
      type: opts.type,
      producer: "setlist-app"
    });
  });
}
const { autoUpdater } = pkg;
function initAutoUpdater(channel = "latest") {
  autoUpdater.channel = channel;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", (info) => {
    console.log("[auto-update] Update available:", info.version);
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.log("[auto-update] Update downloaded:", info.version, "— will install on quit");
  });
  autoUpdater.on("error", (err) => {
    console.error("[auto-update] Error:", err.message);
  });
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1e3);
}
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1A1915",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
      // needed for better-sqlite3 via preload
    }
  });
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[main] Renderer process gone:", details.reason, details.exitCode);
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[main] Failed to load:", code, desc);
  });
  mainWindow.webContents.on("console-message", (_e, level, msg) => {
    const labels = ["V", "I", "W", "E"];
    console.log(`[renderer:${labels[level] || level}] ${msg}`);
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    console.log("[main] Loading URL:", process.env.ELECTRON_RENDERER_URL);
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const htmlPath = join(__dirname, "..", "renderer", "index.html");
    console.log("[main] Loading file:", htmlPath);
    mainWindow.loadFile(htmlPath);
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers(ipcMain);
  createWindow();
  if (!process.env.ELECTRON_RENDERER_URL) {
    initAutoUpdater("latest");
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  app.quit();
});
