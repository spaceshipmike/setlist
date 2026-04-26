import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, CrossQuery } from '../src/index.js';

describe('portfolio_brief enrichment_gaps annotations (S138)', () => {
  let tmpDir: string;
  let dbPath: string;
  let registry: Registry;
  let crossQuery: CrossQuery;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-gaps-'));
    dbPath = join(tmpDir, 'test.db');
    registry = new Registry(dbPath);
    crossQuery = new CrossQuery(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('always returns enrichment_gaps as an array, even when empty', () => {
    // Empty registry — array must still be present, not null or omitted.
    const brief = crossQuery.portfolioBrief();
    expect(Array.isArray(brief.enrichment_gaps)).toBe(true);
    expect(brief.enrichment_gaps).toEqual([]);
  });

  it('flags a sparse code project with description, tech_stack, and digest missing', () => {
    registry.register({ name: 'sparse-proj', type: 'project', status: 'active' });
    const brief = crossQuery.portfolioBrief();
    const entry = brief.enrichment_gaps.find(g => g.project === 'sparse-proj');
    expect(entry).toBeDefined();
    expect(entry!.missing).toEqual(['description', 'tech_stack', 'digest']);
  });

  it('omits a fully enriched code project', () => {
    registry.register({
      name: 'rich-proj',
      type: 'project',
      status: 'active',
      description: 'A well-described project.',
    });
    registry.updateFields('rich-proj', { tech_stack: 'TypeScript' }, 'test');
    registry.refreshProjectDigest({
      project_name: 'rich-proj',
      digest_text: 'A compact essence summary.',
      spec_version: '0.1.0',
      producer: 'test',
    });
    const brief = crossQuery.portfolioBrief();
    expect(brief.enrichment_gaps.find(g => g.project === 'rich-proj')).toBeUndefined();
  });

  it('reports partial enrichment without collapsing to "incomplete"', () => {
    registry.register({
      name: 'almost-proj',
      type: 'project',
      status: 'active',
      description: 'Has a description.',
    });
    registry.updateFields('almost-proj', { tech_stack: 'TypeScript' }, 'test');
    // Digest still missing.
    const brief = crossQuery.portfolioBrief();
    const entry = brief.enrichment_gaps.find(g => g.project === 'almost-proj');
    expect(entry).toBeDefined();
    expect(entry!.missing).toEqual(['digest']);
  });

  it('uses canonical field names matching the registry storage', () => {
    registry.register({ name: 'check-names', type: 'project', status: 'active' });
    const brief = crossQuery.portfolioBrief();
    const entry = brief.enrichment_gaps.find(g => g.project === 'check-names');
    expect(entry).toBeDefined();
    // Each missing entry is a single canonical field name — no prose.
    for (const field of entry!.missing) {
      expect(field).toMatch(/^[a-z_]+$/);
    }
    // Concretely: description, tech_stack, digest are all valid stored field
    // names that agents can pass directly to write_fields / refresh_project_digest.
    expect(['description', 'tech_stack', 'digest']).toEqual(
      expect.arrayContaining(entry!.missing),
    );
  });

  it('treats a one-character description as present (presence only, no quality scoring)', () => {
    registry.register({
      name: 'minimal-desc',
      type: 'project',
      status: 'active',
      description: 'x',
    });
    const brief = crossQuery.portfolioBrief();
    const entry = brief.enrichment_gaps.find(g => g.project === 'minimal-desc');
    expect(entry?.missing).not.toContain('description');
  });

  it('counts description from any prose-tier extended field (description, short_description, medium_description)', () => {
    registry.register({ name: 'short-only', type: 'project', status: 'active' });
    registry.updateFields('short-only', { short_description: 'x' }, 'test');
    const brief = crossQuery.portfolioBrief();
    const entry = brief.enrichment_gaps.find(g => g.project === 'short-only');
    expect(entry?.missing).not.toContain('description');
  });

  it('excludes archived projects from enrichment_gaps', () => {
    registry.register({ name: 'archived-proj', type: 'project', status: 'active' });
    registry.archiveProject('archived-proj');
    const brief = crossQuery.portfolioBrief();
    expect(brief.enrichment_gaps.find(g => g.project === 'archived-proj')).toBeUndefined();
  });

  it('returns entries with exactly {project, missing} keys — no prose, no scoring', () => {
    registry.register({ name: 'shape-check', type: 'project', status: 'active' });
    const brief = crossQuery.portfolioBrief();
    for (const entry of brief.enrichment_gaps) {
      expect(Object.keys(entry).sort()).toEqual(['missing', 'project']);
      expect(typeof entry.project).toBe('string');
      expect(Array.isArray(entry.missing)).toBe(true);
    }
  });

  it('an agent missing-field iteration drives a sensible enrichment workflow', () => {
    // Sanity check: the "missing" field names in a gap entry are the same
    // ones an agent would pass to write_fields / refresh_project_digest to
    // close the gap. After applying those calls the project disappears from
    // enrichment_gaps.
    registry.register({ name: 'flow-check', type: 'project', status: 'active' });
    const before = crossQuery.portfolioBrief().enrichment_gaps.find(g => g.project === 'flow-check');
    expect(before).toBeDefined();

    for (const field of before!.missing) {
      if (field === 'digest') {
        registry.refreshProjectDigest({
          project_name: 'flow-check',
          digest_text: 'A compact essence summary.',
          spec_version: '0.1.0',
          producer: 'test',
        });
      } else {
        registry.updateFields('flow-check', { [field]: 'placeholder' }, 'test');
      }
    }
    const after = crossQuery.portfolioBrief().enrichment_gaps.find(g => g.project === 'flow-check');
    expect(after).toBeUndefined();
  });
});
