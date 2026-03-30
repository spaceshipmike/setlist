import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { connect, getDbPath, initDb } from './db.js';

function newId(): string {
  return randomUUID().replace(/-/g, '');
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const STALE_QUALITY_THRESHOLD = 0.3;
const STALE_ACCESS_THRESHOLD = 2;
const STALE_AGE_DAYS = 90;

export interface ReflectionResult {
  memories_merged: number;
  edges_created: number;
  memories_archived: number;
  summary_blocks_rewritten: number;
  duration_ms: number;
}

export class MemoryReflection {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }

  private open(): Database.Database {
    return connect(this._dbPath);
  }

  /**
   * Run a full reflection cycle: triple-gate archival, summary block rewriting,
   * and enrichment logging.
   *
   * Semantic dedup (cosine similarity) requires embeddings and is skipped in FTS5-only mode.
   */
  reflect(): ReflectionResult {
    const start = Date.now();
    const now = nowIso();

    const db = this.open();
    try {
      let memoriesArchived = 0;
      let edgesCreated = 0;
      let summaryBlocksRewritten = 0;

      // 1. Triple-gate stale memory archival
      memoriesArchived = this.archiveStaleMemories(db, now);

      // 2. Entity/relationship extraction — link memories to projects they mention
      edgesCreated = this.extractRelationships(db, now);

      // 3. Summary block rewriting
      summaryBlocksRewritten = this.rewriteSummaryBlocks(db, now);

      // 4. Log the reflection — use a sentinel memory or skip if no memories exist
      const anyMemory = db.prepare("SELECT id FROM memories LIMIT 1").get() as { id: string } | undefined;
      if (anyMemory) {
        const logId = newId();
        db.prepare(`
          INSERT INTO enrichment_log (id, memory_id, engine_kind, engine_version, created_at)
          VALUES (?, ?, 'reflection-cycle', '1.0', ?)
        `).run(logId, anyMemory.id, now);
      }

      const duration = Date.now() - start;

      return {
        memories_merged: 0, // Semantic dedup requires embeddings
        edges_created: edgesCreated,
        memories_archived: memoriesArchived,
        summary_blocks_rewritten: summaryBlocksRewritten,
        duration_ms: duration,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Triple-gate archival: archive memories that are ALL of:
   * - Low quality/importance (< 0.3)
   * - Low access count (reinforcement_count < 2)
   * - Old (> 90 days since last update)
   *
   * Corrections and static memories are never archived.
   */
  private archiveStaleMemories(db: Database.Database, now: string): number {
    const cutoffDate = new Date(Date.now() - STALE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const stale = db.prepare(`
      SELECT id FROM memories
      WHERE status = 'active'
        AND type != 'correction'
        AND is_static = 0
        AND importance < ?
        AND reinforcement_count < ?
        AND updated_at < ?
    `).all(STALE_QUALITY_THRESHOLD, STALE_ACCESS_THRESHOLD, cutoffDate) as { id: string }[];

    if (stale.length === 0) return 0;

    const archiveStmt = db.prepare(
      "UPDATE memories SET status = 'archived', forget_reason = 'reflection-triple-gate', updated_at = ? WHERE id = ?"
    );
    const versionStmt = db.prepare(`
      INSERT INTO memory_versions (id, memory_id, previous_content, author, change_type, timestamp)
      VALUES (?, ?, NULL, 'system', 'archived', ?)
    `);

    const doArchive = db.transaction(() => {
      for (const { id } of stale) {
        archiveStmt.run(now, id);
        versionStmt.run(newId(), id, now);
      }
    });
    doArchive();

    return stale.length;
  }

  /**
   * Extract relationships between memories that mention the same project.
   */
  private extractRelationships(db: Database.Database, now: string): number {
    // Find memories in the same project that share content terms
    // This is a simplified version — full entity extraction would use LLM
    const projects = db.prepare(
      "SELECT DISTINCT project_id FROM memories WHERE status = 'active' AND project_id IS NOT NULL"
    ).all() as { project_id: string }[];

    let edgesCreated = 0;

    for (const { project_id } of projects) {
      const memories = db.prepare(
        "SELECT id, type FROM memories WHERE project_id = ? AND status = 'active' ORDER BY created_at"
      ).all(project_id) as { id: string; type: string }[];

      // Link decision → pattern and pattern → outcome relationships within the same project
      const decisions = memories.filter(m => m.type === 'decision');
      const patterns = memories.filter(m => m.type === 'pattern');

      for (const decision of decisions) {
        for (const pattern of patterns) {
          const existingEdge = db.prepare(
            'SELECT id FROM memory_edges WHERE source_id = ? AND target_id = ?'
          ).get(decision.id, pattern.id);

          if (!existingEdge) {
            db.prepare(`
              INSERT INTO memory_edges (id, source_id, target_id, relationship_type, weight, confidence, observation_count, created_at)
              VALUES (?, ?, ?, 'related_to', 0.5, 0.3, 1, ?)
            `).run(newId(), decision.id, pattern.id, now);
            edgesCreated++;
          }
        }
      }
    }

    return edgesCreated;
  }

  /**
   * Rewrite summary blocks for each scope level.
   */
  private rewriteSummaryBlocks(db: Database.Database, now: string): number {
    let rewritten = 0;

    // Project-level summary blocks
    const projects = db.prepare(
      "SELECT DISTINCT project_id FROM memories WHERE status = 'active' AND project_id IS NOT NULL"
    ).all() as { project_id: string }[];

    for (const { project_id } of projects) {
      const topMemories = db.prepare(`
        SELECT content, type, importance FROM memories
        WHERE project_id = ? AND status = 'active'
        ORDER BY importance DESC, reinforcement_count DESC
        LIMIT 10
      `).all(project_id) as { content: string; type: string; importance: number }[];

      if (topMemories.length === 0) continue;

      const summary = topMemories
        .map(m => `[${m.type}] ${m.content.slice(0, 200)}`)
        .join('\n');

      const blockId = `project:${project_id}`;
      db.prepare(`
        INSERT INTO summary_blocks (id, scope, label, content, updated_at)
        VALUES (?, 'project', ?, ?, ?)
        ON CONFLICT(scope, label) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
      `).run(blockId, project_id, summary, now);
      rewritten++;
    }

    // Global summary block
    const globalMemories = db.prepare(`
      SELECT content, type, importance FROM memories
      WHERE status = 'active' AND scope IN ('portfolio', 'global')
      ORDER BY importance DESC, reinforcement_count DESC
      LIMIT 10
    `).all() as { content: string; type: string; importance: number }[];

    if (globalMemories.length > 0) {
      const globalSummary = globalMemories
        .map(m => `[${m.type}] ${m.content.slice(0, 200)}`)
        .join('\n');

      db.prepare(`
        INSERT INTO summary_blocks (id, scope, label, content, updated_at)
        VALUES ('global:portfolio', 'portfolio', 'global', ?, ?)
        ON CONFLICT(scope, label) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
      `).run(globalSummary, now);
      rewritten++;
    }

    return rewritten;
  }
}
