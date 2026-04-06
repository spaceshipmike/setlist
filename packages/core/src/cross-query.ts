import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type Database from 'better-sqlite3';
import { connect, getDbPath, initDb } from './db.js';
import { MemoryRetrieval, type RecallResult } from './memory-retrieval.js';

interface CrossQueryResult {
  source: 'registry' | 'memory' | 'cc_memory';
  project: string;
  content: string;
  score: number;
  producer?: string;
  updated_at?: string;
  memory_type?: string;
}

const HIGH_SIGNAL_KEYWORDS = ['decision', 'architecture', 'critical', 'breaking change', 'important'];
const EVERGREEN_FIELDS = new Set(['name', 'type', 'status']);
const DECAY_HALF_LIFE_DAYS = 30;

export class CrossQuery {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }

  private open(): Database.Database {
    return connect(this._dbPath);
  }

  query(opts: {
    query: string;
    scope?: string;
  }): { results: CrossQueryResult[]; summary: string } {
    const scope = opts.scope ?? 'registry';
    let results: CrossQueryResult[] = [];

    if (scope === 'registry' || scope === 'all') {
      results.push(...this.searchRegistry(opts.query));
    }

    if (scope === 'memories' || scope === 'all') {
      results.push(...this.searchMemories(opts.query));
    }

    if (scope === 'all') {
      results.push(...this.searchCcAutoMemory(opts.query));
    }

    // Score and rank
    results = this.rankResults(results, opts.query);

    const summary = this.synthesize(results, opts.query);
    return { results, summary };
  }

  private searchRegistry(query: string): CrossQueryResult[] {
    const db = this.open();
    try {
      const q = `%${query}%`;
      const rows = db.prepare(`
        SELECT p.name, p.description, p.goals, p.updated_at,
               GROUP_CONCAT(pf.field_name || ':' || pf.field_value, '||') as field_data,
               GROUP_CONCAT(pf.producer, '||') as producers
        FROM projects p
        LEFT JOIN project_fields pf ON pf.project_id = p.id
        WHERE p.name LIKE ? OR p.display_name LIKE ? OR p.description LIKE ?
              OR p.goals LIKE ? OR pf.field_value LIKE ?
        GROUP BY p.id
        ORDER BY p.name
      `).all(q, q, q, q, q) as Record<string, unknown>[];

      const results: CrossQueryResult[] = [];
      for (const row of rows) {
        const content = [row.description, row.goals, row.field_data]
          .filter(Boolean)
          .join(' | ');
        results.push({
          source: 'registry',
          project: row.name as string,
          content,
          score: 1.0,
          updated_at: row.updated_at as string,
          producer: (row.producers as string | null)?.split('||')[0],
        });
      }
      return results;
    } finally {
      db.close();
    }
  }

  private searchMemories(query: string): CrossQueryResult[] {
    const retrieval = new MemoryRetrieval(this._dbPath);
    const memories = retrieval.recall({ query, token_budget: 4000 });

    return memories.map(m => ({
      source: 'memory' as const,
      project: m.project_id ?? 'global',
      content: m.content,
      score: m.relevance_score,
      memory_type: m.type,
      updated_at: m.updated_at,
    }));
  }

  private searchCcAutoMemory(query: string): CrossQueryResult[] {
    const results: CrossQueryResult[] = [];
    const claudeDir = join(homedir(), '.claude', 'projects');

    if (!existsSync(claudeDir)) return results;

    try {
      const encodedPaths = readdirSync(claudeDir);
      const q = query.toLowerCase();

      for (const encodedPath of encodedPaths) {
        const memoryFile = join(claudeDir, encodedPath, 'MEMORY.md');
        if (!existsSync(memoryFile)) continue;

        try {
          const content = readFileSync(memoryFile, 'utf-8');
          if (content.toLowerCase().includes(q)) {
            // Extract project name from encoded path
            const projectName = decodeURIComponent(encodedPath).split('/').pop() ?? encodedPath;
            results.push({
              source: 'cc_memory',
              project: projectName,
              content: content.slice(0, 500), // Truncate for budget
              score: 0.5,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Directory listing failed
    }

    return results;
  }

  private rankResults(results: CrossQueryResult[], query: string): CrossQueryResult[] {
    const now = Date.now();

    for (const result of results) {
      // Freshness: time-decay weighting
      if (result.updated_at && !EVERGREEN_FIELDS.has(result.source)) {
        const daysOld = (now - new Date(result.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        const freshnessFactor = Math.exp(-daysOld / DECAY_HALF_LIFE_DAYS);
        result.score *= (0.5 + 0.5 * freshnessFactor);
      }

      // Importance: high-signal keyword boost
      const contentLower = result.content.toLowerCase();
      for (const keyword of HIGH_SIGNAL_KEYWORDS) {
        if (contentLower.includes(keyword)) {
          result.score *= 1.2;
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  portfolioBrief(): {
    projects: { name: string; type: string; status: string; spec_version?: string; updated_at: string }[];
    portfolio_memories: RecallResult[];
    pending_observations: RecallResult[];
    health_indicators: { project: string; issue: string }[];
  } {
    const db = this.open();
    try {
      // Active projects with basic identity
      const projects = db.prepare(`
        SELECT p.name, p.type, p.status, p.updated_at,
               (SELECT pf.field_value FROM project_fields pf WHERE pf.project_id = p.id AND pf.field_name = 'spec_version') as spec_version
        FROM projects p
        WHERE p.status NOT IN ('archived')
        ORDER BY p.name
      `).all() as { name: string; type: string; status: string; updated_at: string; spec_version: string | null }[];

      // Portfolio-scoped and global memories via recall (bootstrap mode)
      const retrieval = new MemoryRetrieval(this._dbPath);
      const portfolioMemories = retrieval.recall({
        token_budget: 4000,
      });

      // Recent observation memories that haven't been acted on
      const pendingObservations = db.prepare(`
        SELECT id, content, content_l0, content_l1, type, scope, importance,
               reinforcement_count, outcome_score, is_pinned, project_id,
               created_at, updated_at
        FROM memories
        WHERE type = 'observation' AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 20
      `).all() as RecallResult[];
      for (const obs of pendingObservations) {
        obs.relevance_score = obs.importance ?? 0.5;
      }

      // Health indicators: stale projects (no update in 30+ days), projects missing capabilities
      const healthIndicators: { project: string; issue: string }[] = [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      for (const p of projects) {
        if (p.status === 'active' && p.updated_at < thirtyDaysAgo) {
          healthIndicators.push({ project: p.name, issue: 'no registry update in 30+ days' });
        }
      }

      const capCounts = db.prepare(`
        SELECT p.name, COUNT(pc.id) as cap_count
        FROM projects p
        LEFT JOIN project_capabilities pc ON pc.project_id = p.id
        WHERE p.status = 'active' AND p.type = 'project'
        GROUP BY p.id
        HAVING cap_count = 0
      `).all() as { name: string; cap_count: number }[];
      for (const row of capCounts) {
        healthIndicators.push({ project: row.name, issue: 'no capabilities registered' });
      }

      return {
        projects: projects.map(p => ({
          name: p.name,
          type: p.type,
          status: p.status,
          spec_version: p.spec_version ?? undefined,
          updated_at: p.updated_at,
        })),
        portfolio_memories: portfolioMemories,
        pending_observations: pendingObservations,
        health_indicators: healthIndicators,
      };
    } finally {
      db.close();
    }
  }

  private synthesize(results: CrossQueryResult[], query: string): string {
    if (results.length === 0) return `No results found for "${query}".`;

    const projectGroups = new Map<string, CrossQueryResult[]>();
    for (const r of results) {
      const existing = projectGroups.get(r.project) ?? [];
      existing.push(r);
      projectGroups.set(r.project, existing);
    }

    const parts: string[] = [`Found ${results.length} result(s) across ${projectGroups.size} project(s):`];
    for (const [project, group] of projectGroups) {
      const sources = [...new Set(group.map(r => r.source))].join(', ');
      parts.push(`- ${project} (${sources}): ${group[0].content.slice(0, 200)}`);
    }

    return parts.join('\n');
  }
}
