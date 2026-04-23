import { createHash } from 'node:crypto';
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const SPEC_CASCADE = ['.fctry/spec.md', 'CLAUDE.md', 'README.md'];

const EXTRACTABLE_EXTS = new Set([
  '.md', '.txt', '.html', '.htm',
  '.pdf', '.docx', '.pptx', '.xlsx',
]);

const IGNORE_FILE = '.digestignore';

interface IgnoreRule {
  regex: RegExp;
  dirOnly: boolean;
  negate: boolean;
}

function patternToRegex(pattern: string, dirOnly: boolean): RegExp {
  const anchored = pattern.startsWith('/');
  const body = anchored ? pattern.slice(1) : pattern;
  let src = '';
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '*' && body[i + 1] === '*') {
      src += '.*';
      i += 2;
      if (body[i] === '/') i += 1;
    } else if (c === '*') {
      src += '[^/]*';
      i += 1;
    } else if (c === '?') {
      src += '[^/]';
      i += 1;
    } else if ('.+^$(){}|[]\\'.includes(c)) {
      src += '\\' + c;
      i += 1;
    } else {
      src += c;
      i += 1;
    }
  }
  const prefix = anchored ? '^' : '(^|.*/)';
  const suffix = dirOnly ? '(/|$)' : '$';
  return new RegExp(prefix + src + suffix);
}

function loadIgnoreRules(projectDir: string): IgnoreRule[] {
  const path = join(projectDir, IGNORE_FILE);
  if (!existsSync(path)) return [];
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return [];
  }
  const rules: IgnoreRule[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    let pattern = line;
    const negate = pattern.startsWith('!');
    if (negate) pattern = pattern.slice(1);
    const dirOnly = pattern.endsWith('/');
    if (dirOnly) pattern = pattern.slice(0, -1);
    if (pattern === '') continue;
    rules.push({ regex: patternToRegex(pattern, dirOnly), dirOnly, negate });
  }
  return rules;
}

function isIgnored(relPath: string, isDir: boolean, rules: IgnoreRule[]): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(relPath)) ignored = !rule.negate;
  }
  return ignored;
}

export interface ProjectVersion {
  kind: 'spec' | 'filetree' | 'none';
  version: string | null;
  source: string | null;
}

function extractSpecVersion(text: string): string | null {
  const fenceMatch = text.match(/^```yaml\n([\s\S]*?)\n```/m);
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/m);
  const yaml = fenceMatch?.[1] ?? frontmatterMatch?.[1];
  if (!yaml) return null;
  const versionMatch = yaml.match(/^\s*spec-version:\s*"?([^"\n]+?)"?\s*$/m);
  return versionMatch?.[1]?.trim() ?? null;
}

function listSupportedDocuments(projectDir: string, depth = 1): string[] {
  const rules = loadIgnoreRules(projectDir);
  const results: string[] = [];
  function walk(dir: string, currentDepth: number): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory() && entry.name.startsWith('_')) continue;
      const full = join(dir, entry.name);
      const rel = relative(projectDir, full);
      if (isIgnored(rel, entry.isDirectory(), rules)) continue;
      if (entry.isDirectory()) {
        if (currentDepth > 0) walk(full, currentDepth - 1);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        const dotIdx = lower.lastIndexOf('.');
        if (dotIdx < 0) continue;
        const ext = lower.slice(dotIdx);
        if (EXTRACTABLE_EXTS.has(ext)) results.push(full);
      }
    }
  }
  walk(projectDir, depth);
  return results.sort();
}

function computeFiletreeHash(projectDir: string, depth = 1): string {
  const files = listSupportedDocuments(projectDir, depth);
  const entries: string[] = [];
  for (const path of files) {
    try {
      const st = statSync(path);
      const rel = path.startsWith(projectDir + '/') ? path.slice(projectDir.length + 1) : path;
      entries.push(`${rel}:${Math.floor(st.mtimeMs)}:${st.size}`);
    } catch {
      // unreadable file, skip
    }
  }
  const ignorePath = join(projectDir, IGNORE_FILE);
  if (existsSync(ignorePath)) {
    try {
      const st = statSync(ignorePath);
      entries.push(`${IGNORE_FILE}:${Math.floor(st.mtimeMs)}:${st.size}`);
    } catch {
      // unreadable, skip
    }
  }
  if (entries.length === 0) return '';
  const h = createHash('sha256');
  h.update(entries.join('\n'));
  return h.digest('hex').slice(0, 16);
}

/**
 * Resolve a project's source-version stamp. Used by digest generation (to store
 * on write) and by digest staleness checks (to compare on read).
 *
 * Cascade:
 *   1. Try .fctry/spec.md, CLAUDE.md, README.md in order; if any has a
 *      `spec-version` in YAML frontmatter, that string is the version.
 *   2. Otherwise, compute a deterministic hash of the project's supported
 *      document tree (sorted relative-path:mtime:size entries, sha256,
 *      truncated to 16 hex chars). Any file change flips the hash.
 *   3. If no spec files and no supported documents exist, return kind: 'none'.
 */
export function computeProjectVersion(projectDir: string, opts?: { depth?: number }): ProjectVersion {
  if (!existsSync(projectDir)) return { kind: 'none', version: null, source: null };
  for (const rel of SPEC_CASCADE) {
    const path = join(projectDir, rel);
    if (!existsSync(path)) continue;
    try {
      const text = readFileSync(path, 'utf-8');
      const version = extractSpecVersion(text);
      if (version) return { kind: 'spec', version, source: rel };
    } catch {
      // unreadable, try next
    }
  }
  const hash = computeFiletreeHash(projectDir, opts?.depth ?? 1);
  if (hash) return { kind: 'filetree', version: hash, source: null };
  return { kind: 'none', version: null, source: null };
}

export function listProjectDocuments(projectDir: string, opts?: { depth?: number }): string[] {
  return listSupportedDocuments(projectDir, opts?.depth ?? 1);
}
