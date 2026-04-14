// @fctry: #health-assessment
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { connect, getDbPath } from './db.js';
import { NotFoundError, findClosestMatch } from './errors.js';

export type HealthTier = 'healthy' | 'at_risk' | 'stale' | 'unknown';
export type HealthDimension = 'activity' | 'completeness' | 'outcomes';

export interface DimensionResult {
  tier: HealthTier;
  reasons: string[];
}

export interface HealthAssessment {
  name: string;
  overall: HealthTier;
  reasons: string[];
  dimensions: Record<HealthDimension, DimensionResult>;
  computed_at: string;
}

export interface PortfolioHealth {
  projects: HealthAssessment[];
  summary: Record<HealthTier, number>;
  computed_at: string;
}

/** Cache TTL for health computations, in milliseconds. Spec: "cached briefly (a few minutes)". */
export const HEALTH_CACHE_TTL_MS = 120_000;

const TIER_RANK: Record<HealthTier, number> = {
  healthy: 0,
  at_risk: 1,
  stale: 2,
  unknown: 3, // treated as worst when unknown
};

function worstTier(tiers: HealthTier[]): HealthTier {
  let worst: HealthTier = 'healthy';
  for (const t of tiers) {
    if (TIER_RANK[t] > TIER_RANK[worst]) worst = t;
  }
  return worst;
}

interface CacheEntry {
  result: HealthAssessment | PortfolioHealth;
  expiresAt: number;
}

export class HealthAssessor {
  private _dbPath: string;
  private cache = new Map<string, CacheEntry>();

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
  }

  get dbPath(): string {
    return this._dbPath;
  }

  /** Clear cached assessments. Primarily for tests. */
  clearCache(): void {
    this.cache.clear();
  }

  private getCached<T extends HealthAssessment | PortfolioHealth>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.result as T;
  }

  private putCached(key: string, result: HealthAssessment | PortfolioHealth): void {
    this.cache.set(key, { result, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS });
  }

  /**
   * Assess a single project by name. Archived projects return Unknown.
   */
  assessProject(name: string, opts?: { noCache?: boolean }): HealthAssessment {
    if (!opts?.noCache) {
      const cached = this.getCached<HealthAssessment>(`p:${name}`);
      if (cached) return cached;
    }
    const db = connect(this._dbPath);
    try {
      const row = db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as Record<string, unknown> | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        const closest = findClosestMatch(name, allNames.map(r => r.name));
        throw new NotFoundError(name, closest);
      }
      const result = this.buildAssessment(db, row);
      this.putCached(`p:${name}`, result);
      return result;
    } finally {
      db.close();
    }
  }

  /**
   * Portfolio-wide assessment: every active (non-archived) project, ordered worst-to-best.
   */
  assessPortfolio(opts?: { noCache?: boolean }): PortfolioHealth {
    if (!opts?.noCache) {
      const cached = this.getCached<PortfolioHealth>('portfolio');
      if (cached) return cached;
    }
    const db = connect(this._dbPath);
    try {
      const rows = db.prepare("SELECT * FROM projects WHERE status != 'archived' ORDER BY name")
        .all() as Record<string, unknown>[];
      const projects: HealthAssessment[] = rows.map(r => this.buildAssessment(db, r));
      projects.sort((a, b) => TIER_RANK[b.overall] - TIER_RANK[a.overall]);
      const summary: Record<HealthTier, number> = {
        healthy: 0, at_risk: 0, stale: 0, unknown: 0,
      };
      for (const p of projects) summary[p.overall]++;
      const result: PortfolioHealth = {
        projects,
        summary,
        computed_at: new Date().toISOString(),
      };
      this.putCached('portfolio', result);
      return result;
    } finally {
      db.close();
    }
  }

  // ── Core assessment builder ────────────────────────────────────

  private buildAssessment(db: Database.Database, row: Record<string, unknown>): HealthAssessment {
    const name = row.name as string;
    const status = row.status as string;
    const type = row.type as string;
    const projectId = row.id as number;
    const computed_at = new Date().toISOString();

    // Archived projects: Unknown, not evaluated.
    if (status === 'archived') {
      const reason = 'archived project — not evaluated';
      return {
        name,
        overall: 'unknown',
        reasons: [reason],
        dimensions: {
          activity: { tier: 'unknown', reasons: [reason] },
          completeness: { tier: 'unknown', reasons: [reason] },
          outcomes: { tier: 'unknown', reasons: [reason] },
        },
        computed_at,
      };
    }

    const activity = this.assessActivity(db, projectId, row);
    const completeness = this.assessCompleteness(db, projectId, row, type);
    const outcomes = this.assessOutcomes(db, name);

    // If every dimension is unknown, overall is unknown.
    const allUnknown = activity.tier === 'unknown' && completeness.tier === 'unknown' && outcomes.tier === 'unknown';
    const overall: HealthTier = allUnknown
      ? 'unknown'
      : worstTier([
          activity.tier === 'unknown' ? 'healthy' : activity.tier,
          completeness.tier === 'unknown' ? 'healthy' : completeness.tier,
          outcomes.tier === 'unknown' ? 'healthy' : outcomes.tier,
        ]);

    const reasons = [
      ...activity.reasons,
      ...completeness.reasons,
      ...outcomes.reasons,
    ];

    return {
      name,
      overall,
      reasons,
      dimensions: { activity, completeness, outcomes },
      computed_at,
    };
  }

  // ── Activity dimension ────────────────────────────────────────
  //
  // Healthy ≤ 7 days, At risk 8–30, Stale > 30. Touch = most recent of:
  //   - projects.updated_at
  //   - latest memory retain for this project
  //   - latest git commit in any declared path (best-effort)

  private assessActivity(db: Database.Database, projectId: number, row: Record<string, unknown>): DimensionResult {
    const projectUpdated = row.updated_at as string;
    const name = row.name as string;

    // Latest memory touch
    let latestMemory: string | null = null;
    try {
      const m = db.prepare(
        `SELECT MAX(created_at) as t FROM memories WHERE project_id = ? AND status = 'active'`
      ).get(name) as { t: string | null } | undefined;
      latestMemory = m?.t ?? null;
    } catch {
      latestMemory = null;
    }

    // Latest git commit across declared paths
    const pathRows = db.prepare('SELECT path FROM project_paths WHERE project_id = ?').all(projectId) as { path: string }[];
    let latestCommit: string | null = null;
    for (const { path } of pathRows) {
      const t = latestCommitInPath(path);
      if (t && (!latestCommit || t > latestCommit)) latestCommit = t;
    }

    const candidates = [projectUpdated, latestMemory, latestCommit].filter((v): v is string => Boolean(v));
    if (candidates.length === 0) {
      return { tier: 'unknown', reasons: ['no activity signals available'] };
    }
    const mostRecent = candidates.reduce((a, b) => (a > b ? a : b));
    const ageMs = Date.now() - new Date(mostRecent).getTime();
    const ageDays = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));

    if (ageDays <= 7) {
      return { tier: 'healthy', reasons: [`active within the last ${ageDays} day${ageDays === 1 ? '' : 's'}`] };
    }
    if (ageDays <= 30) {
      return { tier: 'at_risk', reasons: [`no activity in ${ageDays} days`] };
    }
    return { tier: 'stale', reasons: [`no activity in ${ageDays} days`] };
  }

  // ── Completeness dimension ────────────────────────────────────

  private assessCompleteness(
    db: Database.Database,
    projectId: number,
    row: Record<string, unknown>,
    type: string,
  ): DimensionResult {
    const description = String(row.description ?? '').trim();
    const goals = String(row.goals ?? '').trim();

    const pathCount = (db.prepare('SELECT COUNT(*) as c FROM project_paths WHERE project_id = ?').get(projectId) as { c: number }).c;

    // Extended fields and topics/entities (stored as JSON strings on projects row or in project_fields)
    const fieldRows = db.prepare('SELECT field_name, field_value FROM project_fields WHERE project_id = ?').all(projectId) as { field_name: string; field_value: string }[];
    const fieldMap: Record<string, string> = {};
    for (const f of fieldRows) fieldMap[f.field_name] = f.field_value;

    const topics = String(row.topics ?? fieldMap.topics ?? '').trim();
    const entities = String(row.entities ?? fieldMap.entities ?? '').trim();
    const techStack = (fieldMap.tech_stack ?? '').trim();
    const patterns = (fieldMap.patterns ?? '').trim();

    const isCodeProject =
      type === 'project' &&
      // treat as code if any path contains /Code/ or tech_stack is declared
      ((db.prepare("SELECT 1 FROM project_paths WHERE project_id = ? AND path LIKE '%/Code/%'").get(projectId) != null) ||
        Boolean(techStack));

    const staleReasons: string[] = [];
    const atRiskReasons: string[] = [];

    if (!description) staleReasons.push('description missing');
    if (!goals || goals === '[]') staleReasons.push('no goals');

    if (pathCount === 0) atRiskReasons.push('no paths declared');

    if (isCodeProject) {
      if (!techStack) atRiskReasons.push('tech_stack missing');
      if (!patterns) atRiskReasons.push('patterns missing');
    }

    const topicsEmpty = !topics || topics === '[]';
    const entitiesEmpty = !entities || entities === '[]';
    if (topicsEmpty) atRiskReasons.push('topics empty');
    if (entitiesEmpty) atRiskReasons.push('entities empty');

    if (staleReasons.length > 0) {
      return { tier: 'stale', reasons: staleReasons.concat(atRiskReasons) };
    }
    if (atRiskReasons.length > 0) {
      return { tier: 'at_risk', reasons: atRiskReasons };
    }
    return { tier: 'healthy', reasons: ['profile complete'] };
  }

  // ── Outcomes dimension ────────────────────────────────────────
  //
  // No memories: Healthy (absence is not a negative signal).
  // Recent (<=14d) outcome memory with outcome_score < 0: At risk.
  // Active unresolved contradicts edges: At risk.
  // High corrections ratio (>0.5, min 3 relevant memories): Stale.

  private assessOutcomes(db: Database.Database, projectName: string): DimensionResult {
    let memCount = 0;
    let recentNegative = 0;
    let contradictions = 0;
    let decisionsPlusOutcomes = 0;
    let corrections = 0;

    try {
      const countRow = db.prepare(
        `SELECT COUNT(*) as c FROM memories WHERE project_id = ? AND status = 'active'`
      ).get(projectName) as { c: number };
      memCount = countRow?.c ?? 0;

      if (memCount === 0) {
        return { tier: 'healthy', reasons: ['no feedback history (neutral)'] };
      }

      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const negRow = db.prepare(
        `SELECT COUNT(*) as c FROM memories
         WHERE project_id = ? AND status = 'active'
           AND type = 'outcome' AND outcome_score < 0
           AND created_at >= ?`
      ).get(projectName, cutoff) as { c: number };
      recentNegative = negRow?.c ?? 0;

      // Contradictions: memory_edges where relationship_type='contradicts'
      // and both ends are active memories for this project.
      try {
        const cRow = db.prepare(
          `SELECT COUNT(*) as c
             FROM memory_edges e
             JOIN memories ms ON ms.id = e.source_id
             JOIN memories mt ON mt.id = e.target_id
            WHERE e.relationship_type = 'contradicts'
              AND ms.status = 'active' AND mt.status = 'active'
              AND (ms.project_id = ? OR mt.project_id = ?)`
        ).get(projectName, projectName) as { c: number };
        contradictions = cRow?.c ?? 0;
      } catch {
        contradictions = 0;
      }

      const dRow = db.prepare(
        `SELECT COUNT(*) as c FROM memories
         WHERE project_id = ? AND status = 'active'
           AND type IN ('decision', 'outcome')`
      ).get(projectName) as { c: number };
      decisionsPlusOutcomes = dRow?.c ?? 0;

      const corrRow = db.prepare(
        `SELECT COUNT(*) as c FROM memories
         WHERE project_id = ? AND status = 'active' AND type = 'correction'`
      ).get(projectName) as { c: number };
      corrections = corrRow?.c ?? 0;
    } catch {
      // Memory signals unavailable — return unknown so the dimension
      // doesn't force the overall tier in either direction.
      return { tier: 'unknown', reasons: ['memory signals unavailable'] };
    }

    // High correction ratio → Stale (requires at least 3 memories to count).
    const relevant = decisionsPlusOutcomes + corrections;
    if (relevant >= 3 && corrections / Math.max(1, relevant) > 0.5) {
      return {
        tier: 'stale',
        reasons: [`${corrections} corrections vs ${decisionsPlusOutcomes} decisions/outcomes`],
      };
    }

    const reasons: string[] = [];
    let tier: HealthTier = 'healthy';
    if (recentNegative > 0) {
      tier = 'at_risk';
      reasons.push(`${recentNegative} recent negative outcome${recentNegative === 1 ? '' : 's'}`);
    }
    if (contradictions > 0) {
      tier = 'at_risk';
      reasons.push(`${contradictions} unresolved contradiction${contradictions === 1 ? '' : 's'} in project memories`);
    }
    if (reasons.length === 0) {
      reasons.push('recent signals look healthy');
    }
    return { tier, reasons };
  }
}

// ── Git touch helper (best-effort, bounded) ───────────────────────

function latestCommitInPath(path: string): string | null {
  try {
    if (!path || !existsSync(path)) return null;
    // Only run git if a .git directory (or gitfile) exists, to avoid
    // expensive failures.
    if (!existsSync(join(path, '.git'))) return null;
    const out = execFileSync('git', ['-C', path, 'log', '-1', '--format=%cI'], {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}
