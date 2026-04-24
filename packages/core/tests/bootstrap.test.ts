import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { Bootstrap, Registry } from '../src/index.js';

describe('Bootstrap', () => {
  let tmpDir: string;
  let dbPath: string;
  let bootstrap: Bootstrap;
  let registry: Registry;
  let templateDir: string;
  let codeRoot: string;
  let areaRoot: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-bootstrap-'));
    dbPath = join(tmpDir, 'test.db');
    bootstrap = new Bootstrap(dbPath);
    registry = new Registry(dbPath);

    // Create template directories
    templateDir = join(tmpDir, 'templates');
    mkdirSync(join(templateDir, 'code-repo'), { recursive: true });
    writeFileSync(join(templateDir, 'code-repo', 'README.md'), '# PROJECT_NAME\n');
    writeFileSync(join(templateDir, 'code-repo', '.gitignore'), 'node_modules/\n');
    mkdirSync(join(templateDir, 'area-of-focus'), { recursive: true });
    writeFileSync(join(templateDir, 'area-of-focus', 'notes.md'), '# Notes\n');

    // Create target root directories
    codeRoot = join(tmpDir, 'Code');
    areaRoot = join(tmpDir, 'Areas');
    mkdirSync(codeRoot, { recursive: true });
    mkdirSync(areaRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── S38: Bootstrap Configuration ──────────────────────────────

  describe('configureBootstrap (S38)', () => {
    it('stores and retrieves path root mappings', () => {
      const config = bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, area_of_focus: areaRoot },
      });
      expect(config.path_roots.project).toBe(codeRoot);
      expect(config.path_roots.area_of_focus).toBe(areaRoot);
    });

    it('stores and retrieves template directory', () => {
      const config = bootstrap.configureBootstrap({
        template_dir: templateDir,
      });
      expect(config.template_dir).toBe(templateDir);
    });

    it('persists configuration across instances', () => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot },
        template_dir: templateDir,
      });

      const fresh = new Bootstrap(dbPath);
      const config = fresh.getConfig();
      expect(config.path_roots.project).toBe(codeRoot);
      expect(config.template_dir).toBe(templateDir);
    });

    it('returns current config when called with no arguments', () => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot },
      });
      const config = bootstrap.configureBootstrap({});
      expect(config.path_roots.project).toBe(codeRoot);
    });

    it('merges partial updates with existing config', () => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot },
      });
      bootstrap.configureBootstrap({
        path_roots: { area_of_focus: areaRoot },
      });
      const config = bootstrap.getConfig();
      expect(config.path_roots.project).toBe(codeRoot);
      expect(config.path_roots.area_of_focus).toBe(areaRoot);
    });

    it('rejects invalid project type in path_roots', () => {
      expect(() => {
        bootstrap.configureBootstrap({
          path_roots: { invalid_type: '/some/path' } as any,
        });
      }).toThrow('INVALID_INPUT');
    });

    it('rejects nonexistent template directory', () => {
      expect(() => {
        bootstrap.configureBootstrap({
          template_dir: '/nonexistent/path',
        });
      }).toThrow('INVALID_INPUT');
    });
  });

  // ── S39: Bootstrap a Code Project ──────────────────────────────

  describe('bootstrapProject - code project (S39)', () => {
    beforeEach(() => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, area_of_focus: areaRoot },
        template_dir: templateDir,
      });
    });

    it('creates folder, applies templates, inits git, and registers', () => {
      const result = bootstrap.bootstrapProject({
        name: 'my-new-app',
        type: 'project',
      });

      expect(result.name).toBe('my-new-app');
      expect(result.path).toBe(join(codeRoot, 'my-new-app'));
      expect(result.git_initialized).toBe(true);
      expect(result.templates_applied).toBe(true);

      // Folder exists with template files
      expect(existsSync(join(codeRoot, 'my-new-app', 'README.md'))).toBe(true);
      expect(existsSync(join(codeRoot, 'my-new-app', '.gitignore'))).toBe(true);

      // Git repo initialized
      expect(existsSync(join(codeRoot, 'my-new-app', '.git'))).toBe(true);

      // Project registered in registry
      const project = registry.getProject('my-new-app', 'full');
      expect(project).not.toBeNull();
      expect(project!.name).toBe('my-new-app');
      expect(project!.type).toBe('project');
      expect(project!.paths).toContain(join(codeRoot, 'my-new-app'));
    });

    it('atomicity: cleans up folder if registration fails', () => {
      // Register the project first so bootstrap's registration will fail
      registry.register({
        name: 'conflict-project',
        type: 'project',
        status: 'active',
      });

      expect(() => {
        bootstrap.bootstrapProject({
          name: 'conflict-project',
          type: 'project',
        });
      }).toThrow('DUPLICATE');

      // Folder should be cleaned up
      expect(existsSync(join(codeRoot, 'conflict-project'))).toBe(false);
    });
  });

  // ── S40: Bootstrap a Non-Code Project ──────────────────────────

  describe('bootstrapProject - non-code project (S40)', () => {
    beforeEach(() => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, area_of_focus: areaRoot },
        template_dir: templateDir,
      });
    });

    it('creates folder with templates but no git when skip_git is true', () => {
      const projectRoot = join(tmpDir, 'Projects');
      mkdirSync(projectRoot, { recursive: true });

      const result = bootstrap.bootstrapProject({
        name: 'q2-planning',
        type: 'project',
        path_override: join(projectRoot, 'q2-planning'),
        skip_git: true,
      });

      expect(result.git_initialized).toBe(false);
      expect(existsSync(join(projectRoot, 'q2-planning'))).toBe(true);
      expect(existsSync(join(projectRoot, 'q2-planning', '.git'))).toBe(false);

      const project = registry.getProject('q2-planning', 'full');
      expect(project).not.toBeNull();
      expect(project!.type).toBe('project');
    });
  });

  // ── S41: Bootstrap a Non-Code Project (spec 0.13: retired area_of_focus type)

  describe('bootstrapProject - non-code project (S41, spec 0.13)', () => {
    beforeEach(() => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, non_code_project: areaRoot },
        template_dir: templateDir,
      });
    });

    it('creates folder at non_code path root, no git, registers as project', () => {
      const result = bootstrap.bootstrapProject({
        name: 'health-tracking',
        type: 'non_code_project',
      });

      expect(result.path).toBe(join(areaRoot, 'health-tracking'));
      expect(result.git_initialized).toBe(false);

      // No git
      expect(existsSync(join(areaRoot, 'health-tracking', '.git'))).toBe(false);

      // spec 0.13: registered as db type='project'; area is a separate assignment
      const project = registry.getProject('health-tracking', 'full');
      expect(project).not.toBeNull();
      expect(project!.type).toBe('project');
      expect(project!.area).toBeNull();

      // Producer can attach an area via set_project_area after bootstrap
      registry.setProjectArea('health-tracking', 'Health');
      const reloaded = registry.getProject('health-tracking', 'full')!;
      expect(reloaded.area).toBe('Health');
    });
  });

  // ── S42: Bootstrap Without Configuration ──────────────────────────

  describe('bootstrapProject - unconfigured (S42)', () => {
    it('fails with clear error when not configured', () => {
      expect(() => {
        bootstrap.bootstrapProject({
          name: 'test-project',
          type: 'project',
        });
      }).toThrow('BOOTSTRAP_NOT_CONFIGURED');
    });

    it('error message mentions configure_bootstrap', () => {
      try {
        bootstrap.bootstrapProject({
          name: 'test-project',
          type: 'project',
        });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('configure_bootstrap');
      }
    });

    it('does not create any folder when unconfigured', () => {
      const before = readdirSync(tmpDir);
      try {
        bootstrap.bootstrapProject({
          name: 'ghost-project',
          type: 'project',
        });
      } catch {
        // expected
      }
      // No new directories created (outside of what beforeEach set up)
      expect(existsSync(join(codeRoot, 'ghost-project'))).toBe(false);
    });

    it('does not register project when unconfigured', () => {
      try {
        bootstrap.bootstrapProject({
          name: 'ghost-project',
          type: 'project',
        });
      } catch {
        // expected
      }
      expect(registry.getProject('ghost-project')).toBeNull();
    });
  });

  // ── S43: Bootstrap with Path Override ──────────────────────────

  describe('bootstrapProject - path override (S43)', () => {
    beforeEach(() => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, area_of_focus: areaRoot },
        template_dir: templateDir,
      });
    });

    it('creates at overridden path instead of default', () => {
      const experimentsDir = join(tmpDir, 'experiments');
      mkdirSync(experimentsDir, { recursive: true });
      const overridePath = join(experimentsDir, 'special-project');

      const result = bootstrap.bootstrapProject({
        name: 'special-project',
        type: 'project',
        path_override: overridePath,
      });

      expect(result.path).toBe(overridePath);
      expect(existsSync(overridePath)).toBe(true);
      expect(existsSync(join(overridePath, '.git'))).toBe(true);
      expect(result.templates_applied).toBe(true);

      // Registered with override path
      const project = registry.getProject('special-project', 'full');
      expect(project!.paths).toContain(overridePath);
    });
  });

  // ── S44: Bootstrap When Folder Already Exists ──────────────────

  describe('bootstrapProject - folder exists (S44)', () => {
    beforeEach(() => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, area_of_focus: areaRoot },
        template_dir: templateDir,
      });
    });

    it('refuses to overwrite existing folder', () => {
      const existingPath = join(codeRoot, 'existing-project');
      mkdirSync(existingPath, { recursive: true });
      writeFileSync(join(existingPath, 'important.txt'), 'do not delete');

      expect(() => {
        bootstrap.bootstrapProject({
          name: 'existing-project',
          type: 'project',
        });
      }).toThrow('FOLDER_EXISTS');

      // Original file untouched
      expect(readFileSync(join(existingPath, 'important.txt'), 'utf-8')).toBe('do not delete');
    });

    it('does not register project when folder exists', () => {
      mkdirSync(join(codeRoot, 'blocked-project'), { recursive: true });

      try {
        bootstrap.bootstrapProject({
          name: 'blocked-project',
          type: 'project',
        });
      } catch {
        // expected
      }

      expect(registry.getProject('blocked-project')).toBeNull();
    });

    it('reports both folder and name conflicts separately', () => {
      // Register project with this name
      registry.register({
        name: 'double-conflict',
        type: 'project',
        status: 'active',
      });
      // Also create the folder
      mkdirSync(join(codeRoot, 'double-conflict'), { recursive: true });

      try {
        bootstrap.bootstrapProject({
          name: 'double-conflict',
          type: 'project',
        });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        // Should get the folder exists error (checked first)
        expect(err.message).toContain('FOLDER_EXISTS');
      }
    });
  });

  // ── Portfolio-root .gitignore: auto-append new project dir ─────

  describe('bootstrapProject - parent .gitignore update', () => {
    beforeEach(() => {
      bootstrap.configureBootstrap({
        path_roots: { project: codeRoot, area_of_focus: areaRoot },
        template_dir: templateDir,
      });
    });

    it('appends project dir to parent .gitignore when parent is a git repo with an existing .gitignore', () => {
      execSync('git init -q', { cwd: codeRoot, stdio: 'pipe' });
      const gitignorePath = join(codeRoot, '.gitignore');
      writeFileSync(gitignorePath, 'existing-project/\nanother-project/\n');

      const result = bootstrap.bootstrapProject({
        name: 'portfolio-thing',
        type: 'project',
      });

      expect(result.parent_gitignore_updated).toBe(true);
      const after = readFileSync(gitignorePath, 'utf8');
      expect(after).toContain('existing-project/');
      expect(after).toContain('portfolio-thing/');
      expect(after.endsWith('\n')).toBe(true);
    });

    it('does not duplicate an existing entry', () => {
      execSync('git init -q', { cwd: codeRoot, stdio: 'pipe' });
      const gitignorePath = join(codeRoot, '.gitignore');
      writeFileSync(gitignorePath, 'portfolio-thing/\n');

      const result = bootstrap.bootstrapProject({
        name: 'portfolio-thing',
        type: 'project',
      });

      expect(result.parent_gitignore_updated).toBe(false);
      const after = readFileSync(gitignorePath, 'utf8');
      const occurrences = after.split('\n').filter((l) => l.trim() === 'portfolio-thing/').length;
      expect(occurrences).toBe(1);
    });

    it('is a no-op when parent directory is not a git repo', () => {
      const gitignorePath = join(codeRoot, '.gitignore');
      writeFileSync(gitignorePath, 'something/\n');

      const result = bootstrap.bootstrapProject({
        name: 'standalone',
        type: 'project',
      });

      expect(result.parent_gitignore_updated).toBe(false);
      expect(readFileSync(gitignorePath, 'utf8')).toBe('something/\n');
    });

    it('is a no-op when parent is a git repo but has no .gitignore', () => {
      execSync('git init -q', { cwd: codeRoot, stdio: 'pipe' });
      // No .gitignore is created in the parent.

      const result = bootstrap.bootstrapProject({
        name: 'no-ignore',
        type: 'project',
      });

      expect(result.parent_gitignore_updated).toBe(false);
      expect(existsSync(join(codeRoot, '.gitignore'))).toBe(false);
    });
  });
});
