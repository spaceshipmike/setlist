/**
 * Named-term extraction from spec frontmatter.
 *
 * The digest pipeline summarizes a project into ~500–800 tokens of prose.
 * Named tools, libraries, products, agents, and patterns that the user lists
 * in the spec frontmatter (tech-stack, patterns, goals) routinely get
 * compressed away by the digest model — the original "Milkdown miss"
 * (2026-04-26 GLM digest dropped the Milkdown editor name from knowmarks
 * because it was at position 17 of a long patterns array). The bake-off
 * (scripts/digest-bakeoff.ts, 2026-04-27) showed that prompt elaboration
 * to fix this trades off against GLM's reasoning budget — v3 prompt
 * brought back the empty-content failure mode the temp=0 fix had solved.
 *
 * This helper bypasses the prompt entirely: parse the spec frontmatter,
 * extract the named-entity-like phrases verbatim, and store them as a
 * separate column on `project_digests`. Downstream consumers (knowmarks
 * `score_saves`, future ref-routing) can FTS5-match canaries against this
 * field independently of the digest embedding, avoiding both the
 * compression problem and the vocab-tail dilution risk of embedding the
 * keywords directly into the digest text.
 *
 * Format chosen: JSON array of phrases (paren-aware comma-split items
 * from the source fields). Phrases are kept intact rather than further
 * tokenized so that "SQLite (WAL + FTS5)" stays as one phrase and FTS5
 * search for either "SQLite" or "FTS5" matches it.
 */

import { parse as yamlParse } from './yaml-parse.js';

const FRONTMATTER_FIELDS = ['tech-stack', 'patterns', 'goals'] as const;

/**
 * Extract spec-frontmatter named terms from a source text (typically
 * spec.md content). Returns a deduplicated array of phrase-style entries
 * suitable for storage in a JSON-array text column.
 *
 * Empty array on:
 *   - source has no recognizable frontmatter
 *   - frontmatter has none of the configured fields
 *   - YAML parsing failure (silent — caller treats no terms as no signal)
 */
export function extractNamedTerms(sourceText: string): string[] {
  const yamlText = extractFrontmatter(sourceText);
  if (!yamlText) return [];

  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = yamlParse(yamlText);
  } catch {
    return [];
  }

  // Most spec authors put their tech-stack / patterns / goals inside a
  // synopsis: nested object. A few use top-level keys. Read both.
  const synopsis = (frontmatter.synopsis as Record<string, unknown>) ?? {};

  const items: string[] = [];
  for (const field of FRONTMATTER_FIELDS) {
    const value = synopsis[field] ?? frontmatter[field];
    if (value == null) continue;
    items.push(...itemize(value));
  }

  return dedupe(items);
}

function extractFrontmatter(content: string): string | null {
  // Format 1: code-fenced YAML inside the markdown. Some specs include an
  // inner `---\n` open delimiter (knowmarks/fctry/orchestrator); ensemble
  // uses the bare ```yaml block. The optional `---\n` accommodates both.
  const fenceMatch = content.match(/```ya?ml\s*\n(?:---\s*\n)?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].replace(/^---\s*$/gm, '');

  // Format 2: bare frontmatter at the top of the file.
  const bareMatch = content.match(/^---\s*\n([\s\S]*?)---\s*\n/);
  if (bareMatch) return bareMatch[1];

  return null;
}

/**
 * Coerce a frontmatter field value (may be string, array, or other) into
 * a flat list of phrases. Strings are split on commas at paren-depth 0,
 * so that "SQLite (WAL + FTS5)" is preserved as one phrase rather than
 * splitting on the comma inside the parenthetical.
 */
function itemize(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(s => s.length > 0);
  }
  if (typeof value === 'string') {
    return splitParenAware(value);
  }
  return [];
}

function splitParenAware(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if (ch === ',' && depth === 0) {
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
