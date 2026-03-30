import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { connect, getDbPath, initDb } from './db.js';

function newId(): string {
  return randomUUID().replace(/-/g, '');
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Sanitize FTS5 query: remove special characters that would break MATCH */
function sanitizeFtsQuery(query: string): string {
  // Remove FTS5 special operators and quote/escape special chars
  return query
    .replace(/[*"(){}[\]^~\\:]/g, ' ')
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => `"${t}"`)
    .join(' OR ');
}

export interface RecallResult {
  id: string;
  content: string;
  content_l0: string | null;
  content_l1: string | null;
  type: string;
  scope: string;
  importance: number;
  reinforcement_count: number;
  outcome_score: number;
  is_pinned: boolean;
  relevance_score: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export class MemoryRetrieval {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }

  private open(): Database.Database {
    return connect(this._dbPath);
  }

  /**
   * Recall memories matching a query with budget control.
   * If no query is provided, runs bootstrap mode (returns project memory profile).
   */
  recall(opts: {
    query?: string | null;
    project_id?: string | null;
    token_budget?: number;
    scope?: string | null;
  }): RecallResult[] {
    const db = this.open();
    try {
      const isBootstrap = !opts.query;
      const budget = opts.token_budget ?? 4000;

      let candidates: RecallResult[];
      if (isBootstrap) {
        candidates = this.bootstrapRecall(db, opts.project_id);
      } else {
        candidates = this.searchRecall(db, opts.query!, opts.project_id);
      }

      // Apply budget control: estimate ~4 chars per token
      const charsPerToken = 4;
      let usedTokens = 0;
      const results: RecallResult[] = [];

      for (const mem of candidates) {
        // Choose content tier based on remaining budget
        const fullLen = mem.content.length;
        const l0Len = mem.content_l0?.length ?? fullLen;
        const tokensNeeded = Math.ceil(Math.min(l0Len, fullLen) / charsPerToken);

        if (usedTokens + tokensNeeded > budget && results.length > 0) break;

        results.push(mem);
        usedTokens += Math.ceil(fullLen / charsPerToken);
      }

      // Log the recall
      this.logRecall(db, opts.query ?? null, isBootstrap ? 'bootstrap' : 'search', budget, opts.project_id ?? null, results);

      return results;
    } finally {
      db.close();
    }
  }

  private bootstrapRecall(db: Database.Database, projectId: string | null | undefined): RecallResult[] {
    // Bootstrap: return pinned memories first, then highest-scored active memories
    let sql = `
      SELECT * FROM memories WHERE status = 'active'
    `;
    const params: unknown[] = [];

    if (projectId) {
      sql += ` AND (project_id = ? OR scope IN ('portfolio', 'global'))`;
      params.push(projectId);
    } else {
      // No project filter — return all scopes
    }

    sql += ` ORDER BY is_pinned DESC, importance DESC, reinforcement_count DESC, updated_at DESC LIMIT 50`;

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r, idx) => this.rowToResult(r, 1.0 - idx * 0.01));
  }

  private searchRecall(db: Database.Database, query: string, projectId: string | null | undefined): RecallResult[] {
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];

    // FTS5 search
    const ftsResults = this.ftsSearch(db, sanitized, projectId);

    // Combine and score
    return this.scoreAndRank(ftsResults);
  }

  private ftsSearch(db: Database.Database, ftsQuery: string, projectId: string | null | undefined): RecallResult[] {
    try {
      let sql: string;
      const params: unknown[] = [];

      if (projectId) {
        sql = `
          SELECT m.*, fts.rank
          FROM memory_fts fts
          JOIN memories m ON m.id = fts.memory_id
          WHERE memory_fts MATCH ?
            AND m.status = 'active'
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
          ORDER BY fts.rank
          LIMIT 50
        `;
        params.push(ftsQuery);
      }

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map((r, idx) => this.rowToResult(r, 1.0 / (idx + 1)));
    } catch {
      // FTS5 query may fail on unusual input — fall back to LIKE search
      return this.likeSearch(db, ftsQuery, projectId);
    }
  }

  private likeSearch(db: Database.Database, query: string, projectId: string | null | undefined): RecallResult[] {
    const likeQ = `%${query.replace(/"/g, '')}%`;
    let sql = `
      SELECT * FROM memories
      WHERE status = 'active'
      AND (content LIKE ? OR content_l0 LIKE ?)
    `;
    const params: unknown[] = [likeQ, likeQ];

    if (projectId) {
      sql += ` AND (project_id = ? OR scope IN ('portfolio', 'global'))`;
      params.push(projectId);
    }

    sql += ' ORDER BY importance DESC LIMIT 50';

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r, idx) => this.rowToResult(r, 0.5 / (idx + 1)));
  }

  private scoreAndRank(results: RecallResult[]): RecallResult[] {
    // Composite scoring: combine relevance, reinforcement, recency, outcome
    for (const r of results) {
      const reinforcementBoost = Math.log(r.reinforcement_count + 1);
      const outcomeBoost = r.outcome_score * 0.2;
      const pinnedBoost = r.is_pinned ? 10.0 : 0;

      // Recency: days since update, decay factor
      const daysSinceUpdate = (Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-daysSinceUpdate / 30); // 30-day half-life

      r.relevance_score = r.relevance_score + reinforcementBoost * 0.1 + outcomeBoost + pinnedBoost + recencyFactor * 0.2;
    }

    // Sort by score descending
    results.sort((a, b) => b.relevance_score - a.relevance_score);

    // Score cliff detection: stop if next score drops > 50% from current
    const clipped: RecallResult[] = [];
    for (let i = 0; i < results.length; i++) {
      clipped.push(results[i]);
      if (i > 0 && i < results.length - 1) {
        const ratio = results[i + 1].relevance_score / results[i].relevance_score;
        if (ratio < 0.3 && clipped.length >= 3) break; // Score cliff
      }
    }

    return clipped;
  }

  private rowToResult(row: Record<string, unknown>, baseScore: number): RecallResult {
    return {
      id: row.id as string,
      content: row.content as string,
      content_l0: row.content_l0 as string | null,
      content_l1: row.content_l1 as string | null,
      type: row.type as string,
      scope: row.scope as string,
      importance: row.importance as number,
      reinforcement_count: row.reinforcement_count as number,
      outcome_score: row.outcome_score as number,
      is_pinned: Boolean(row.is_pinned),
      relevance_score: baseScore,
      project_id: row.project_id as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  private logRecall(
    db: Database.Database,
    query: string | null,
    mode: string,
    budget: number,
    projectId: string | null,
    results: RecallResult[],
  ): void {
    const auditId = newId();
    const memoryIds = JSON.stringify(results.map(r => r.id));
    const scores = JSON.stringify(results.map(r => ({ id: r.id, score: r.relevance_score })));

    db.prepare(`
      INSERT INTO recall_audit (id, query, mode, budget_tokens, scope, project_id, memory_ids_returned, scores, timestamp)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `).run(auditId, query, mode, budget, projectId, memoryIds, scores, nowIso());
  }
}
