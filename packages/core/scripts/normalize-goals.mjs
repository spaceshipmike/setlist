#!/usr/bin/env node
// One-shot normalizer: rewrite prose `goals` rows to canonical JSON-array shape.
// Usage:
//   node packages/core/scripts/normalize-goals.mjs            # dry-run by default
//   node packages/core/scripts/normalize-goals.mjs --apply    # write changes

import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DB_PATH = process.env.SETLIST_DB_PATH
  ?? join(homedir(), '.local/share/project-registry/registry.db');

const apply = process.argv.includes('--apply');

function parseProse(goals) {
  const trimmed = goals.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  if (trimmed.includes('\n')) {
    return trimmed.split('\n').map(g => g.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  }
  return [trimmed];
}

const db = new Database(DB_PATH);
const rows = db.prepare(
  `SELECT name, goals FROM projects WHERE goals IS NOT NULL AND goals != '' AND goals NOT LIKE '[%'`
).all();

if (rows.length === 0) {
  console.log('No prose-shaped goals rows found. Nothing to do.');
  process.exit(0);
}

const update = db.prepare('UPDATE projects SET goals = ? WHERE name = ?');
let changed = 0;

console.log(`${apply ? 'Applying' : 'Dry-run'}: ${rows.length} prose row(s)\n`);

for (const { name, goals } of rows) {
  const arr = parseProse(goals);
  const serialized = JSON.stringify(arr);
  console.log(`  ${name}`);
  console.log(`    was: ${goals.length > 80 ? goals.slice(0, 80) + '…' : goals}`);
  console.log(`    now: ${arr.length} item(s) — ${arr.map(g => `"${g.length > 50 ? g.slice(0, 50) + '…' : g}"`).join(', ')}`);
  if (apply) {
    update.run(serialized, name);
    changed++;
  }
  console.log();
}

db.close();

if (apply) {
  console.log(`Applied: ${changed} row(s) normalized.`);
} else {
  console.log(`Dry-run complete. Re-run with --apply to write changes.`);
}
