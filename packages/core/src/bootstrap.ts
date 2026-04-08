import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { connect, getDbPath, initDb } from './db.js';
import { Registry } from './registry.js';
import { RegistryError } from './errors.js';
import type { ProjectType } from './models.js';

export interface BootstrapConfig {
  path_roots: Record<string, string>;
  template_dir?: string;
  archive_path_root?: string;
}

export interface BootstrapProjectOpts {
  name: string;
  type: ProjectType;
  status?: string;
  description?: string;
  goals?: string;
  display_name?: string;
  path_override?: string;
  skip_git?: boolean;
  producer?: string;
}

export interface BootstrapResult {
  name: string;
  path: string;
  type: ProjectType;
  git_initialized: boolean;
  templates_applied: boolean;
}

export class BootstrapNotConfiguredError extends RegistryError {
  constructor() {
    super(
      'BOOTSTRAP_NOT_CONFIGURED',
      'Bootstrap is not configured.',
      'Call configure_bootstrap first to set path roots for your project types and a template directory.',
    );
    this.name = 'BootstrapNotConfiguredError';
  }
}

export class BootstrapFolderExistsError extends RegistryError {
  constructor(path: string) {
    super(
      'FOLDER_EXISTS',
      `The folder '${path}' already exists.`,
      'Choose a different name, provide a path_override to a different location, or remove the existing folder manually.',
    );
    this.name = 'BootstrapFolderExistsError';
  }
}

export class Bootstrap {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }

  private open() {
    return connect(this._dbPath);
  }

  configureBootstrap(opts: {
    path_roots?: Record<string, string>;
    template_dir?: string;
    archive_path_root?: string;
  }): BootstrapConfig {
    const db = this.open();
    try {
      const upsert = db.prepare(
        "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)"
      );

      if (opts.path_roots !== undefined) {
        for (const [type, path] of Object.entries(opts.path_roots)) {
          if (type !== 'project' && type !== 'non_code_project' && type !== 'area_of_focus') {
            throw new RegistryError(
              'INVALID_INPUT',
              `Invalid project type '${type}' in path_roots. Must be 'project', 'non_code_project', or 'area_of_focus'.`,
            );
          }
          upsert.run(`bootstrap_path_root_${type}`, path);
        }
      }

      if (opts.archive_path_root !== undefined) {
        upsert.run('bootstrap_archive_path_root', opts.archive_path_root);
      }

      if (opts.template_dir !== undefined) {
        if (!existsSync(opts.template_dir)) {
          throw new RegistryError(
            'INVALID_INPUT',
            `Template directory '${opts.template_dir}' does not exist.`,
          );
        }
        upsert.run('bootstrap_template_dir', opts.template_dir);
      }

      return this._getConfig(db);
    } finally {
      db.close();
    }
  }

  getConfig(): BootstrapConfig {
    const db = this.open();
    try {
      return this._getConfig(db);
    } finally {
      db.close();
    }
  }

  private _getConfig(db: ReturnType<typeof connect>): BootstrapConfig {
    const rows = db.prepare(
      "SELECT key, value FROM schema_meta WHERE key LIKE 'bootstrap_%'"
    ).all() as { key: string; value: string }[];

    const config: BootstrapConfig = { path_roots: {} };
    for (const row of rows) {
      if (row.key === 'bootstrap_template_dir') {
        config.template_dir = row.value;
      } else if (row.key === 'bootstrap_archive_path_root') {
        config.archive_path_root = row.value;
      } else if (row.key.startsWith('bootstrap_path_root_')) {
        const type = row.key.replace('bootstrap_path_root_', '');
        config.path_roots[type] = row.value;
      }
    }
    return config;
  }

  bootstrapProject(opts: BootstrapProjectOpts): BootstrapResult {
    const db = this.open();
    try {
      const config = this._getConfig(db);

      // Check configuration exists
      if (Object.keys(config.path_roots).length === 0) {
        throw new BootstrapNotConfiguredError();
      }

      // Resolve target path
      let targetPath: string;
      if (opts.path_override) {
        targetPath = opts.path_override;
      } else {
        const root = config.path_roots[opts.type];
        if (!root) {
          throw new RegistryError(
            'BOOTSTRAP_NOT_CONFIGURED',
            `No path root configured for type '${opts.type}'.`,
            `Call configure_bootstrap to set a path root for '${opts.type}'.`,
          );
        }
        targetPath = join(root, opts.name);
      }

      // Check folder doesn't already exist
      if (existsSync(targetPath)) {
        throw new BootstrapFolderExistsError(targetPath);
      }

      // Check project name isn't already registered
      const registry = new Registry(this._dbPath);
      const existing = registry.getProject(opts.name);
      if (existing) {
        throw new RegistryError(
          'DUPLICATE',
          `A project named '${opts.name}' is already registered.`,
          `Use update_project() to modify it, or choose a different name.`,
        );
      }

      // Create folder
      mkdirSync(targetPath, { recursive: true });

      let templatesApplied = false;
      let gitInitialized = false;

      try {
        // Copy templates if configured
        if (config.template_dir && existsSync(config.template_dir)) {
          const templateSubdir = this._resolveTemplateSubdir(config.template_dir, opts.type);
          if (templateSubdir && existsSync(templateSubdir)) {
            cpSync(templateSubdir, targetPath, { recursive: true });
            templatesApplied = true;
          }
        }

        // Git init for code projects (unless skip_git)
        if (opts.type === 'project' && !opts.skip_git) {
          execSync('git init -q', { cwd: targetPath, stdio: 'pipe' });
          execSync('git add .', { cwd: targetPath, stdio: 'pipe' });
          execSync('git commit -q -m "Initial project scaffold from bootstrap_project" --allow-empty', {
            cwd: targetPath,
            stdio: 'pipe',
          });
          gitInitialized = true;
        }

        // Register in the registry
        registry.register({
          name: opts.name,
          type: opts.type,
          status: opts.status ?? 'active',
          description: opts.description ?? '',
          goals: opts.goals ?? '',
          display_name: opts.display_name,
          paths: [targetPath],
          producer: opts.producer ?? 'bootstrap',
        });
      } catch (err) {
        // Atomicity: clean up folder if something failed after creation
        try {
          rmSync(targetPath, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup
        }
        throw err;
      }

      return {
        name: opts.name,
        path: targetPath,
        type: opts.type,
        git_initialized: gitInitialized,
        templates_applied: templatesApplied,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Archive a project: set status, release ports/caps, and optionally move folders
   * to the archive path root (stripping .git before moving).
   */
  archiveProject(name: string): {
    ports_released: number;
    capabilities_cleared: number;
    folders_moved: string[];
  } {
    const registry = new Registry(this._dbPath);
    const result = registry.archiveProject(name);

    const config = this.getConfig();
    const folders_moved: string[] = [];

    if (!config.archive_path_root) {
      return { ...result, folders_moved };
    }

    // Get project paths
    const project = registry.getProject(name, 'standard');
    const paths = (project as Record<string, unknown>)?.paths as string[] | undefined;
    if (!paths || paths.length === 0) {
      return { ...result, folders_moved };
    }

    const archiveRoot = config.archive_path_root;
    if (!existsSync(archiveRoot)) {
      mkdirSync(archiveRoot, { recursive: true });
    }

    const db = this.open();
    try {
      const projectRow = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined;
      if (!projectRow) return { ...result, folders_moved };

      for (const srcPath of paths) {
        if (!existsSync(srcPath)) continue;

        const folderName = srcPath.split('/').pop()!;
        const destPath = join(archiveRoot, folderName);

        // Strip .git before moving
        const gitDir = join(srcPath, '.git');
        if (existsSync(gitDir)) {
          rmSync(gitDir, { recursive: true, force: true });
        }
        const gitModules = join(srcPath, '.gitmodules');
        if (existsSync(gitModules)) {
          rmSync(gitModules, { force: true });
        }

        // Move folder
        try {
          renameSync(srcPath, destPath);
        } catch {
          // Cross-device move: copy then remove
          cpSync(srcPath, destPath, { recursive: true });
          rmSync(srcPath, { recursive: true, force: true });
        }

        // Update path in registry
        db.prepare('UPDATE project_paths SET path = ? WHERE project_id = ? AND path = ?')
          .run(destPath, projectRow.id, srcPath);

        folders_moved.push(destPath);
      }
    } finally {
      db.close();
    }

    return { ...result, folders_moved };
  }

  private _resolveTemplateSubdir(templateDir: string, type: ProjectType): string | null {
    // Look for type-specific subdirectory first
    const typeMap: Record<string, string[]> = {
      project: ['code-repo', 'project', 'code_project'],
      area_of_focus: ['area-of-focus', 'area_of_focus', 'area'],
    };

    const candidates = typeMap[type] ?? [];
    for (const candidate of candidates) {
      const subdir = join(templateDir, candidate);
      if (existsSync(subdir) && statSync(subdir).isDirectory()) {
        return subdir;
      }
    }

    // Fall back to the template dir itself if no subdirectory matches
    const entries = readdirSync(templateDir);
    if (entries.length > 0) {
      return templateDir;
    }

    return null;
  }
}
