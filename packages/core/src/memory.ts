import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { connect, getDbPath, initDb } from './db.js';
import { type MemoryType, type MemoryScope, type MemoryBelief, MEMORY_TYPES, MEMORY_SCOPES, MEMORY_BELIEFS } from './models.js';
import { InvalidInputError, NotFoundError } from './errors.js';

// Types that warrant proactive contradiction detection (spec §2.12)
const CONTRADICTION_TYPES = new Set<string>(['preference', 'correction', 'learning']);

const CORRECTION_MIN_IMPORTANCE = 0.9;
const EMA_ALPHA = 0.1;

function newId(): string {
  return randomUUID().replace(/-/g, '');
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}

function contentHash(memoryType: string, normalizedContent: string): string {
  const payload = `${memoryType}:${normalizedContent}`;
  return createHash('sha256').update(payload, 'utf-8').digest('hex').slice(0, 16);
}

export class MemoryStore {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }

  private open(): Database.Database {
    return connect(this._dbPath);
  }

  // ── Retain ────────────────────────────────────────────────

  retain(opts: {
    content: string;
    type: string;
    project_id?: string | null;
    scope?: string | null;
    tags?: string[] | null;
    session_id?: string | null;
    agent_role?: string | null;
    importance?: number | null;
    is_static?: boolean;
    is_inference?: boolean;
    is_pinned?: boolean;
    forget_after?: string | null;
    belief?: string | null;
    extraction_confidence?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    entities?: Array<{ name: string; type: string }> | null;
    parent_version_id?: string | null;
  }): { memory_id: string; is_new: boolean; reinforcement_count: number; potential_conflicts?: Array<{ id: string; content: string; type: string }> } {
    if (!MEMORY_TYPES.has(opts.type as MemoryType)) {
      throw new InvalidInputError(`Unknown memory type '${opts.type}'. Allowed: ${[...MEMORY_TYPES].join(', ')}`);
    }

    const normalized = normalizeContent(opts.content);
    const hash = contentHash(opts.type, normalized);
    const now = nowIso();
    const scope = opts.scope ?? (opts.project_id ? 'project' : 'global');

    if (opts.scope && !MEMORY_SCOPES.has(opts.scope as MemoryScope)) {
      throw new InvalidInputError(`Unknown scope '${opts.scope}'. Allowed: ${[...MEMORY_SCOPES].join(', ')}`);
    }

    // Validate belief
    if (opts.belief != null && !MEMORY_BELIEFS.has(opts.belief as MemoryBelief)) {
      throw new InvalidInputError(`Unknown belief '${opts.belief}'. Allowed: ${[...MEMORY_BELIEFS].join(', ')}`);
    }

    // Validate entities
    if (opts.entities != null) {
      if (!Array.isArray(opts.entities)) {
        throw new InvalidInputError('Entities must be an array');
      }
      for (const e of opts.entities) {
        if (!e.name || typeof e.name !== 'string' || !e.type || typeof e.type !== 'string') {
          throw new InvalidInputError('Each entity must have a name (string) and type (string)');
        }
      }
    }

    // Context memories cannot be pinned
    const isPinned = opts.type === 'context' ? false : (opts.is_pinned ?? false);

    // parent_version_id only valid for procedural type
    if (opts.parent_version_id != null && opts.type !== 'procedural') {
      throw new InvalidInputError('parent_version_id is only valid for procedural type memories');
    }

    let importance = opts.importance ?? 0.5;
    if (opts.type === 'correction' && importance < CORRECTION_MIN_IMPORTANCE) {
      importance = CORRECTION_MIN_IMPORTANCE;
    }

    const db = this.open();
    try {
      // Check for existing memory with same hash (dedup)
      let existing: { id: string; reinforcement_count: number } | undefined;

      if (opts.project_id == null) {
        // NULL project_id: SQLite treats NULLs as distinct, use explicit SELECT
        existing = db.prepare(
          `SELECT id, reinforcement_count FROM memories WHERE content_hash = ? AND project_id IS NULL AND scope = ? AND status = 'active'`
        ).get(hash, scope) as typeof existing;
      } else {
        existing = db.prepare(
          `SELECT id, reinforcement_count FROM memories WHERE content_hash = ? AND project_id = ? AND scope = ? AND status = 'active'`
        ).get(hash, opts.project_id, scope) as typeof existing;
      }

      if (existing) {
        const newCount = existing.reinforcement_count + 1;
        db.prepare(
          `UPDATE memories SET reinforcement_count = ?, updated_at = ? WHERE id = ?`
        ).run(newCount, now, existing.id);

        return { memory_id: existing.id, is_new: false, reinforcement_count: newCount };
      }

      // Proactive contradiction detection (spec §2.12):
      // For preference/correction/learning types, search for existing active memories
      // with the same project scope that may contradict this new memory.
      let potentialConflicts: Array<{ id: string; content: string; type: string }> | undefined;
      if (CONTRADICTION_TYPES.has(opts.type)) {
        potentialConflicts = this.detectConflicts(db, opts.content, opts.type, opts.project_id ?? null, scope);
      }

      // Insert new memory
      const memoryId = newId();
      const tagsStr = opts.tags ? JSON.stringify(opts.tags) : null;
      const entitiesStr = opts.entities ? JSON.stringify(opts.entities) : null;

      // Validate parent_version_id if provided
      if (opts.parent_version_id != null) {
        const parent = db.prepare('SELECT id, type, is_current FROM memories WHERE id = ? AND status = ?').get(opts.parent_version_id, 'active') as { id: string; type: string; is_current: number } | undefined;
        if (!parent) {
          throw new NotFoundError(`Parent memory '${opts.parent_version_id}' not found or not active`);
        }
        if (parent.type !== 'procedural') {
          throw new InvalidInputError(`Parent memory '${opts.parent_version_id}' is type '${parent.type}', not 'procedural'`);
        }
        // Set parent's is_current to false
        db.prepare('UPDATE memories SET is_current = 0, updated_at = ? WHERE id = ?').run(now, opts.parent_version_id);
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
      `).run(
        memoryId, opts.content, opts.type, importance,
        opts.project_id ?? null, scope, opts.agent_role ?? null,
        opts.session_id ?? null, tagsStr,
        hash, opts.is_static ? 1 : 0, opts.is_inference ? 1 : 0,
        isPinned ? 1 : 0,
        opts.belief ?? null, opts.extraction_confidence ?? null,
        opts.valid_from ?? null, opts.valid_until ?? null, entitiesStr,
        opts.parent_version_id ?? null,
        now, now, opts.forget_after ?? null,
      );

      // Create version record
      const versionId = newId();
      db.prepare(`
        INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
        VALUES (?, ?, NULL, 'system', 'created', ?)
      `).run(versionId, memoryId, now);

      // Create source record
      if (opts.session_id || opts.agent_role) {
        const sourceId = newId();
        db.prepare(`
          INSERT INTO memory_sources (id, memory_id, project_id, session_id, agent_role, context_snippet, timestamp)
          VALUES (?, ?, ?, ?, ?, NULL, ?)
        `).run(sourceId, memoryId, opts.project_id ?? null, opts.session_id ?? null, opts.agent_role ?? null, now);
      }

      const result: { memory_id: string; is_new: boolean; reinforcement_count: number; potential_conflicts?: Array<{ id: string; content: string; type: string }> } = {
        memory_id: memoryId, is_new: true, reinforcement_count: 1,
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

  private detectConflicts(
    db: Database.Database,
    content: string,
    type: string,
    projectId: string | null,
    scope: string,
  ): Array<{ id: string; content: string; type: string }> {
    // Use FTS5 to find existing active memories with similar content
    // in the same project scope and type family
    const words = content
      .replace(/[*"(){}[\]^~\\:]/g, ' ')
      .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 2); // skip short words

    if (words.length === 0) return [];

    // Use the most distinctive words (up to 5) for the FTS5 query
    const queryTerms = words.slice(0, 5).map(t => `"${t}"`).join(' OR ');

    try {
      let sql: string;
      const params: unknown[] = [queryTerms];

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

      const rows = db.prepare(sql).all(...params) as Array<{ id: string; content: string; type: string; content_hash: string }>;

      // Exclude exact dedup matches (same content hash)
      const newHash = contentHash(type, normalizeContent(content));
      return rows
        .filter(r => r.content_hash !== newHash)
        .map(r => ({ id: r.id, content: r.content, type: r.type }));
    } catch {
      // FTS5 query failure — skip conflict detection silently
      return [];
    }
  }

  // ── Feedback ──────────────────────────────────────────────

  feedback(opts: {
    memory_ids: string[];
    outcome: string;
    session_id?: string | null;
  }): { updated_count: number; memory_ids: string[]; new_scores: Record<string, number> } {
    const signal = opts.outcome === 'success' ? 1.0 : 0.0;
    const now = nowIso();
    const updatedIds: string[] = [];
    const newScores: Record<string, number> = {};

    const db = this.open();
    try {
      const doFeedback = db.transaction(() => {
        for (const mid of opts.memory_ids) {
          const row = db.prepare('SELECT id, outcome_score FROM memories WHERE id = ?').get(mid) as {
            id: string; outcome_score: number;
          } | undefined;
          if (!row) continue;

          const newScore = row.outcome_score + EMA_ALPHA * (signal - row.outcome_score);
          db.prepare('UPDATE memories SET outcome_score = ?, updated_at = ? WHERE id = ?').run(newScore, now, mid);

          // Create version record for the feedback event
          const versionId = newId();
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

  correct(opts: {
    memory_id: string;
    new_content: string;
    reason: string;
    session_id?: string | null;
    agent_role?: string | null;
  }): { correction_id: string; superseded_id: string; edge_id: string } {
    const now = nowIso();
    const db = this.open();
    try {
      const original = db.prepare('SELECT * FROM memories WHERE id = ?').get(opts.memory_id) as Record<string, unknown> | undefined;
      if (!original) throw new NotFoundError(opts.memory_id);

      const normalized = normalizeContent(opts.new_content);
      const hash = contentHash('correction', normalized);

      // Check if identical correction already exists
      const existingCorrection = db.prepare(
        `SELECT id, reinforcement_count FROM memories WHERE content_hash = ? AND project_id IS ? AND scope = ? AND status = 'active'`
      ).get(hash, original.project_id, original.scope) as { id: string; reinforcement_count: number } | undefined;

      let correctionId: string;
      if (existingCorrection) {
        correctionId = existingCorrection.id;
        db.prepare('UPDATE memories SET reinforcement_count = ?, updated_at = ? WHERE id = ?')
          .run(existingCorrection.reinforcement_count + 1, now, correctionId);
      } else {
        correctionId = newId();
        const tagsStr = original.tags as string | null;

        db.prepare(`
          INSERT INTO memories (
            id, content, type, importance, confidence, status,
            project_id, scope, agent_role, session_id, tags,
            content_hash, reinforcement_count, outcome_score,
            is_static, is_inference, is_pinned,
            created_at, updated_at
          ) VALUES (?, ?, 'correction', ?, 0.5, 'active', ?, ?, ?, ?, ?, ?, 1, 0.0, ?, 0, 0, ?, ?)
        `).run(
          correctionId, opts.new_content, CORRECTION_MIN_IMPORTANCE,
          original.project_id, original.scope,
          opts.agent_role ?? null, opts.session_id ?? null, tagsStr,
          hash, original.is_static,
          now, now,
        );

        const versionId = newId();
        db.prepare(`
          INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
          VALUES (?, ?, NULL, 'system', 'created', ?)
        `).run(versionId, correctionId, now);
      }

      // Archive original
      db.prepare("UPDATE memories SET status = 'superseded', updated_at = ? WHERE id = ?").run(now, opts.memory_id);

      const archiveVersionId = newId();
      db.prepare(`
        INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
        VALUES (?, ?, ?, 'system', 'superseded', ?)
      `).run(archiveVersionId, opts.memory_id, original.content as string, now);

      // Create contradicts edge
      const edgeId = newId();
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

  forget(opts: { memory_id: string; reason: string }): { memory_id: string; status: string } {
    const now = nowIso();
    const db = this.open();
    try {
      const row = db.prepare('SELECT id, content FROM memories WHERE id = ?').get(opts.memory_id) as {
        id: string; content: string;
      } | undefined;
      if (!row) throw new NotFoundError(opts.memory_id);

      db.prepare("UPDATE memories SET status = 'archived', forget_reason = ?, updated_at = ? WHERE id = ?")
        .run(opts.reason, now, opts.memory_id);

      const versionId = newId();
      db.prepare(`
        INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
        VALUES (?, ?, ?, 'system', 'archived', ?)
      `).run(versionId, opts.memory_id, row.content, now);

      return { memory_id: opts.memory_id, status: 'archived' };
    } finally {
      db.close();
    }
  }

  // ── Inspect ───────────────────────────────────────────────

  inspectMemory(memoryId: string): Record<string, unknown> {
    const db = this.open();
    try {
      const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId) as Record<string, unknown> | undefined;
      if (!memory) throw new NotFoundError(memoryId);

      // Parse tags from JSON
      if (memory.tags && typeof memory.tags === 'string') {
        try { memory.tags = JSON.parse(memory.tags as string); } catch { /* keep as string */ }
      }
      // Convert booleans
      memory.is_static = Boolean(memory.is_static);
      memory.is_inference = Boolean(memory.is_inference);
      memory.is_pinned = Boolean(memory.is_pinned);

      const versions = db.prepare(
        'SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY timestamp'
      ).all(memoryId);

      const edges = db.prepare(
        'SELECT * FROM memory_edges WHERE source_id = ? OR target_id = ? ORDER BY created_at'
      ).all(memoryId, memoryId);

      const sources = db.prepare(
        'SELECT * FROM memory_sources WHERE memory_id = ? ORDER BY timestamp'
      ).all(memoryId);

      const enrichment = db.prepare(
        'SELECT * FROM enrichment_log WHERE memory_id = ? ORDER BY created_at'
      ).all(memoryId);

      return { memory, versions, edges, sources, enrichment_log: enrichment };
    } finally {
      db.close();
    }
  }

  // ── Status ────────────────────────────────────────────────

  memoryStatus(projectId?: string): Record<string, unknown> {
    const db = this.open();
    try {
      let typeCondition = '';
      const typeParams: unknown[] = [];
      if (projectId) {
        typeCondition = ' WHERE project_id = ?';
        typeParams.push(projectId);
      }

      const countsByType = db.prepare(
        `SELECT type, COUNT(*) as count FROM memories${typeCondition} GROUP BY type`
      ).all(...typeParams) as { type: string; count: number }[];

      const countsByStatus = db.prepare(
        `SELECT status, COUNT(*) as count FROM memories${typeCondition} GROUP BY status`
      ).all(...typeParams) as { status: string; count: number }[];

      const totalRow = db.prepare(
        `SELECT COUNT(*) as count FROM memories${typeCondition}`
      ).get(...typeParams) as { count: number };

      const byType: Record<string, number> = {};
      for (const r of countsByType) byType[r.type] = r.count;

      const byStatus: Record<string, number> = {};
      for (const r of countsByStatus) byStatus[r.status] = r.count;

      // Temporal info
      const lastRetain = db.prepare(
        `SELECT MAX(created_at) as ts FROM memories${typeCondition}`
      ).get(...typeParams) as { ts: string | null };

      const lastRecall = db.prepare(
        'SELECT MAX(timestamp) as ts FROM recall_audit'
      ).get() as { ts: string | null };

      // Embedding provider from config (stored in schema_meta)
      const providerRow = db.prepare(
        "SELECT value FROM schema_meta WHERE key = 'embedding_provider'"
      ).get() as { value: string } | undefined;

      return {
        counts_by_type: byType,
        counts_by_status: byStatus,
        total: totalRow.count,
        temporal: {
          last_retain: lastRetain.ts,
          last_recall: lastRecall.ts,
        },
        embedding_provider: providerRow?.value ?? 'none',
      };
    } finally {
      db.close();
    }
  }

  // ── Configure ─────────────────────────────────────────────

  configureMemory(opts: {
    embedding_provider?: string;
    reflect_schedule?: string;
    reflect_threshold?: number;
  }): Record<string, string> {
    const db = this.open();
    try {
      const upsert = db.prepare(
        "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)"
      );

      if (opts.embedding_provider !== undefined) {
        upsert.run('embedding_provider', opts.embedding_provider);
      }
      if (opts.reflect_schedule !== undefined) {
        upsert.run('reflect_schedule', opts.reflect_schedule);
      }
      if (opts.reflect_threshold !== undefined) {
        upsert.run('reflect_threshold', String(opts.reflect_threshold));
      }

      // Return current config
      const rows = db.prepare(
        "SELECT key, value FROM schema_meta WHERE key IN ('embedding_provider', 'reflect_schedule', 'reflect_threshold')"
      ).all() as { key: string; value: string }[];

      const config: Record<string, string> = {};
      for (const r of rows) config[r.key] = r.value;
      return config;
    } finally {
      db.close();
    }
  }
}
