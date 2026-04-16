import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanLocations, applyProposals, Registry } from '../src/index.js';

describe('Migration (S07)', () => {
  let tmpDir: string;
  let codeDir: string;
  let projectsDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-mig-'));
    codeDir = join(tmpDir, 'Code');
    projectsDir = join(tmpDir, 'Projects');
    mkdirSync(codeDir);
    mkdirSync(projectsDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createFctrySpec(dir: string, opts: {
    title?: string;
    status?: string;
    synopsis?: Record<string, unknown>;
  }) {
    const fctryDir = join(dir, '.fctry');
    mkdirSync(fctryDir, { recursive: true });

    const frontmatter: Record<string, unknown> = {
      title: opts.title ?? 'Test Project',
      status: opts.status ?? 'active',
    };

    let yaml = `title: ${frontmatter.title}\nstatus: ${frontmatter.status}\n`;
    if (opts.synopsis) {
      yaml += 'synopsis:\n';
      for (const [k, v] of Object.entries(opts.synopsis)) {
        if (typeof v === 'string') {
          yaml += `  ${k}: "${v}"\n`;
        } else if (Array.isArray(v)) {
          yaml += `  ${k}: [${v.join(', ')}]\n`;
        }
      }
    }

    writeFileSync(join(fctryDir, 'spec.md'), `# Test\n\n\`\`\`yaml\n---\n${yaml}\`\`\`\n\nFirst paragraph of the spec.\n`);
  }

  it('discovers projects from code directory', () => {
    mkdirSync(join(codeDir, 'my-project'));
    mkdirSync(join(codeDir, 'another-project'));

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals.length).toBe(2);
    expect(proposals.map(p => p.name).sort()).toEqual(['another-project', 'my-project']);
  });

  it('extracts rich metadata from fctry specs with synopsis', () => {
    const projDir = join(codeDir, 'rich-project');
    mkdirSync(projDir);
    createFctrySpec(projDir, {
      title: 'Rich Project',
      status: 'active',
      synopsis: {
        short: 'A rich project',
        medium: 'A rich project with full metadata',
        'tech-stack': ['typescript', 'sqlite'],
        patterns: ['singleton', 'observer'],
        goals: ['goal-one', 'goal-two'],
      },
    });

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals.length).toBe(1);
    const p = proposals[0];
    expect(p.source).toBe('fctry-synopsis');
    expect(p.display_name).toBe('Rich Project');
    expect(p.description).toContain('rich project');
    expect(p.extended_fields.tech_stack).toEqual(['typescript', 'sqlite']);
    expect(p.extended_fields.patterns).toEqual(['singleton', 'observer']);
    expect(p.goals).toContain('goal-one');
  });

  it('extracts from brief.md in Projects directory', () => {
    const projDir = join(projectsDir, 'home-reno');
    mkdirSync(projDir);
    writeFileSync(join(projDir, 'brief.md'), '# Home Renovation\n\nPlanning the kitchen renovation project with contractor bids.\n\n## Timeline\n\nQ3 2026\n');

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals.length).toBe(1);
    expect(proposals[0].source).toBe('brief');
    expect(proposals[0].description).toContain('kitchen renovation');
    expect(proposals[0].project_type).toBe('project');
  });

  it('creates sparse entries for directory-only projects', () => {
    mkdirSync(join(codeDir, 'bare-project'));

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals.length).toBe(1);
    expect(proposals[0].source).toBe('directory');
    expect(proposals[0].display_name).toBe('Bare Project');
    expect(proposals[0].description).toBe('');
  });

  it('derives display names from directory slugs', () => {
    mkdirSync(join(codeDir, 'project-registry-service'));

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals[0].display_name).toBe('Project Registry Service');
  });

  it('skips hidden directories and node_modules', () => {
    mkdirSync(join(codeDir, '.hidden-dir'));
    mkdirSync(join(codeDir, 'node_modules'));
    mkdirSync(join(codeDir, 'real-project'));

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals.length).toBe(1);
    expect(proposals[0].name).toBe('real-project');
  });

  it('deduplicates dual-surface projects', () => {
    const codeProj = join(codeDir, 'dual-project');
    const projProj = join(projectsDir, 'dual-project');
    mkdirSync(codeProj);
    mkdirSync(projProj);

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals.length).toBe(1);
    expect(proposals[0].paths.length).toBe(2);
  });

  describe('applyProposals', () => {
    it('registers proposals and discovers ports', () => {
      const projDir = join(codeDir, 'apply-test');
      mkdirSync(projDir);
      writeFileSync(join(projDir, '.env'), 'PORT=4000');

      const proposals = scanLocations({ codeDir, projectsDir });
      const dbPath = join(tmpDir, 'test.db');
      const result = applyProposals(proposals, dbPath);

      expect(result.registered).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.ports_claimed).toBe(1);

      // Verify registration
      const registry = new Registry(dbPath);
      const project = registry.getProject('apply-test');
      expect(project).not.toBeNull();
    });

    it('skips duplicates on re-run', () => {
      mkdirSync(join(codeDir, 'dup-test'));

      const dbPath = join(tmpDir, 'test.db');
      const proposals = scanLocations({ codeDir, projectsDir });
      applyProposals(proposals, dbPath);
      const result2 = applyProposals(proposals, dbPath);

      expect(result2.registered).toBe(0);
      expect(result2.skipped).toBe(1);
    });

    it('port clashes are skipped, not errors', () => {
      const proj1 = join(codeDir, 'proj-a');
      const proj2 = join(codeDir, 'proj-b');
      mkdirSync(proj1);
      mkdirSync(proj2);
      writeFileSync(join(proj1, '.env'), 'PORT=3000');
      writeFileSync(join(proj2, '.env'), 'PORT=3000');

      const dbPath = join(tmpDir, 'test.db');
      const proposals = scanLocations({ codeDir, projectsDir });
      const result = applyProposals(proposals, dbPath);

      // Both registered, but only first gets the port
      expect(result.registered).toBe(2);
      expect(result.ports_claimed).toBe(1); // Second port clashes
    });
  });

  it('normalizes status strings', () => {
    const projDir = join(codeDir, 'building-project');
    mkdirSync(projDir);
    createFctrySpec(projDir, { title: 'Building', status: 'building' });

    const proposals = scanLocations({ codeDir, projectsDir });
    expect(proposals[0].status).toBe('active'); // building → active
  });
});
