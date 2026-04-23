import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listProjectDocuments, computeProjectVersion } from '../src/project-version.js';

describe('listProjectDocuments — walker ignore patterns', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'setlist-walker-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('includes supported documents at depth 1', () => {
    writeFileSync(join(dir, 'overview.md'), '# hello');
    writeFileSync(join(dir, 'notes.pdf'), 'pdf');
    const files = listProjectDocuments(dir);
    expect(files.map(f => f.replace(dir + '/', ''))).toEqual(['notes.pdf', 'overview.md']);
  });

  it('skips underscore-prefixed subdirectories by default', () => {
    writeFileSync(join(dir, 'keep.md'), 'k');
    mkdirSync(join(dir, '_Duplicates'));
    writeFileSync(join(dir, '_Duplicates', 'copy.pdf'), 'dup');
    mkdirSync(join(dir, '_archive'));
    writeFileSync(join(dir, '_archive', 'old.md'), 'old');
    const files = listProjectDocuments(dir);
    const rels = files.map(f => f.replace(dir + '/', ''));
    expect(rels).toEqual(['keep.md']);
    expect(rels).not.toContain('_Duplicates/copy.pdf');
    expect(rels).not.toContain('_archive/old.md');
  });

  it('honors .digestignore patterns on top of the underscore default', () => {
    writeFileSync(join(dir, 'keep.md'), 'k');
    writeFileSync(join(dir, 'scratch.tmp.md'), 't');
    mkdirSync(join(dir, 'drafts'));
    writeFileSync(join(dir, 'drafts', 'wip.md'), 'w');
    mkdirSync(join(dir, 'backup'));
    writeFileSync(join(dir, 'backup', 'old.pdf'), 'b');
    writeFileSync(join(dir, '.digestignore'), 'drafts/\nbackup/\n*.tmp.md\n# comment ignored\n');

    const files = listProjectDocuments(dir);
    const rels = files.map(f => f.replace(dir + '/', ''));
    expect(rels).toEqual(['keep.md']);
  });

  it('supports re-include via leading !', () => {
    writeFileSync(join(dir, 'keep.md'), 'k');
    mkdirSync(join(dir, 'drafts'));
    writeFileSync(join(dir, 'drafts', 'rough.md'), 'r');
    mkdirSync(join(dir, 'drafts', 'final'));
    writeFileSync(join(dir, 'drafts', 'final', 'done.md'), 'd');
    writeFileSync(join(dir, '.digestignore'), 'drafts/\n!drafts/final/\n');

    const files = listProjectDocuments(dir);
    const rels = files.map(f => f.replace(dir + '/', '')).sort();
    expect(rels).toContain('keep.md');
    expect(rels).not.toContain('drafts/rough.md');
  });

  it('composes .digestignore with the underscore skip (union)', () => {
    writeFileSync(join(dir, 'keep.md'), 'k');
    mkdirSync(join(dir, '_Duplicates'));
    writeFileSync(join(dir, '_Duplicates', 'copy.pdf'), 'd');
    mkdirSync(join(dir, 'backup'));
    writeFileSync(join(dir, 'backup', 'old.md'), 'b');
    writeFileSync(join(dir, '.digestignore'), 'backup/\n');

    const files = listProjectDocuments(dir);
    const rels = files.map(f => f.replace(dir + '/', ''));
    expect(rels).toEqual(['keep.md']);
  });
});

describe('computeProjectVersion — filetree hash reflects ignore patterns', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'setlist-hash-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('flips the hash when .digestignore is added', () => {
    writeFileSync(join(dir, 'keep.md'), 'k');
    mkdirSync(join(dir, 'drafts'));
    writeFileSync(join(dir, 'drafts', 'wip.md'), 'w');
    const before = computeProjectVersion(dir);
    expect(before.kind).toBe('filetree');

    writeFileSync(join(dir, '.digestignore'), 'drafts/\n');
    const after = computeProjectVersion(dir);
    expect(after.kind).toBe('filetree');
    expect(after.version).not.toBe(before.version);
  });
});
