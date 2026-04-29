import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { connect, getDbPath, initDb } from './db.js';
import { Registry } from './registry.js';
import { InvalidProjectTypeError, RegistryError } from './errors.js';
import type { ProjectType } from './models.js';
import { snapshotRecipe } from './recipes/store.js';
import { walkRecipe, resumeWalk } from './recipes/walk.js';
import type { ProjectContext } from './recipes/templates.js';
import type {
  CleanupLog,
  RunnerEnvelope,
  StepResult,
} from './recipes/runner.js';
import type { McpToolCaller } from './recipes/mcp-caller.js';
import type { RecipeSnapshot } from './recipes/types.js';

// spec 0.13 retired 'area_of_focus' — bootstrap only creates 'project' rows now.
// 'non_code_project' is still accepted for routing to a different pathRoot; it
// still writes db.type = 'project' and the caller is expected to assign an area.
type BootstrapType = ProjectType | 'code_project' | 'non_code_project';

function resolveBootstrapType(type: BootstrapType): {
  pathRootKey: string;
  dbType: ProjectType;
  isCodeProject: boolean;
} {
  if (type === 'non_code_project') {
    return { pathRootKey: 'non_code_project', dbType: 'project', isCodeProject: false };
  }
  return { pathRootKey: 'project', dbType: 'project', isCodeProject: true };
}

/**
 * Spec 0.26: expand a "~/" prefix to the user's home directory. The user-managed
 * project_types table stores default_directory as "~/Code" or "~/Projects" so
 * a fresh registry works out of the box on any machine.
 */
function expandHome(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  if (p === '~') return homedir();
  return p;
}

export interface BootstrapConfig {
  path_roots: Record<string, string>;
  template_dir?: string;
  archive_path_root?: string;
}

export interface BootstrapProjectOpts {
  name: string;
  /**
   * Legacy discriminator (spec 0.13–0.25). Either pass `type` (string) for the
   * legacy path-roots config-driven flow, or pass `project_type_id` (spec 0.26)
   * to drive bootstrap from the user-managed project_types table. When both
   * are provided, project_type_id wins.
   */
  type?: BootstrapType;
  /**
   * spec 0.26: id of a row in the user-managed project_types table.
   * Drives default_directory (root for the new folder) and git_init.
   */
  project_type_id?: number;
  status?: string;
  description?: string;
  goals?: string | string[];
  display_name?: string;
  path_override?: string;
  skip_git?: boolean;
  producer?: string;
  // spec 0.13: pass-through to Registry.register for area + parent linking
  area?: string | null;
  parent_project?: string | null;
  /**
   * Spec 0.29: optional email_account drives the mail-create-mailbox
   * primitive's `{project.email_account}` token at bootstrap time. Stored
   * on the project on register-in-registry. Null/empty means "no project-
   * level email" — recipe steps fall back to the per-type default encoded
   * in the binding (see templates.ts for the `{name|fallback}` syntax).
   */
  email_account?: string | null;
  /**
   * Spec 0.28: optional dry-run mode — runs pre-flight + symbolic walk
   * without touching disk, the registry, or external systems (S148).
   */
  dry_run?: boolean;
  /**
   * Spec 0.28: optional MCP host caller used by mcp-tool primitives. When
   * absent and the recipe contains mcp-tool steps, those steps surface
   * "no host MCP client connected" at pre-flight (S143).
   */
  mcp_caller?: McpToolCaller;
}

/**
 * Per-step result entry for the BootstrapResult.executed_steps array.
 * Mirrors the runner's StepResult but pruned to the public surface
 * (no internal fields like primitive_id).
 */
export interface ExecutedStep {
  position: number;
  name: string;
  shape: 'filesystem-op' | 'shell-command' | 'mcp-tool' | 'register-in-registry';
  status: 'succeeded' | 'failed' | 'skipped' | 'not-run' | 'pending';
  output?: string;
  error_output?: string;
}

export interface BootstrapResult {
  name: string;
  path: string;
  type: ProjectType;
  /** Convenience flag — true when the git-init built-in ran successfully. */
  git_initialized: boolean;
  /** Convenience flag — true when the copy-template built-in ran successfully. */
  templates_applied: boolean;
  /** Convenience flag — true when the update-parent-gitignore built-in ran. */
  parent_gitignore_updated: boolean;
  /**
   * Spec 0.28: per-step trace of every primitive that ran in the recipe,
   * plus the final register-in-registry trailer. Replaces the
   * boolean-only feedback loop the v0.27 result envelope offered.
   */
  executed_steps?: ExecutedStep[];
}

/**
 * Spec 0.28: stop-and-report state returned when bootstrap fails mid-run
 * (S144). The user (or calling agent) chooses Retry / Skip / Abandon and
 * the engine resumes from the failed step (or cleans up).
 */
export interface BootstrapPendingState {
  /** Marker discriminator — distinguishes from BootstrapResult and pre-flight failures. */
  kind: 'pending';
  /** Project name the bootstrap attempt is bound to. */
  name: string;
  /** Resolved project path (folder may or may not have been created). */
  path: string;
  /** Project type id (from the user-managed project_types table). */
  project_type_id: number;
  /** Snapshot of the recipe that was executed (immutable until resolved). */
  snapshot: RecipeSnapshot;
  /** Per-step status — same shape as BootstrapResult.executed_steps. */
  executed_steps: ExecutedStep[];
  /** Position of the failed step (1-based for surfacing, 0-based here). */
  failed_at: number;
  /** Verbatim error output from the failed step. */
  error_output: string;
  /** Cleanup log — the data Abandon walks to undo filesystem and git work. */
  cleanup: CleanupLog;
  /** Carry the original opts (used by Retry/Skip/Abandon to recover context). */
  original_opts: BootstrapProjectOpts;
}

/**
 * Spec 0.28: pre-flight failure envelope (S143). Returned when at least
 * one step's pre-flight check fails — no side effects have occurred.
 */
export interface BootstrapPreflightFailure {
  kind: 'pre-flight-failed';
  name: string;
  preflight_failures: { position: number; primitive_name: string; reason: string }[];
}

/**
 * Spec 0.28: dry-run trace (S148). Per-step symbolic walk with pre-flight
 * markers; no execution, no side effects.
 */
export interface BootstrapDryRunTrace {
  kind: 'dry-run';
  name: string;
  path: string;
  steps: {
    position: number;
    primitive_name: string;
    shape: 'filesystem-op' | 'shell-command' | 'mcp-tool' | 'register-in-registry';
    resolved_params: Record<string, string>;
    preflight_ok: boolean;
    preflight_reason?: string;
  }[];
}

/** Discriminated union returned by bootstrapProject (spec 0.28). */
export type BootstrapEnvelope =
  | (BootstrapResult & { kind: 'success' })
  | BootstrapPendingState
  | BootstrapPreflightFailure
  | BootstrapDryRunTrace;

// If the new project's parent directory is itself a git repo with an existing
// .gitignore, append the project's directory name so the parent repo ignores
// the nested sub-repo. This is the portfolio-root convention at ~/Code/ where
// each project is its own git repo. Best-effort: never fails the bootstrap.
function maybeUpdateParentGitignore(targetPath: string): boolean {
  try {
    const parentDir = dirname(targetPath);
    if (!existsSync(join(parentDir, '.git'))) return false;

    const gitignorePath = join(parentDir, '.gitignore');
    if (!existsSync(gitignorePath)) return false;

    const projectName = basename(targetPath);
    const entryWithSlash = `${projectName}/`;
    const content = readFileSync(gitignorePath, 'utf8');
    const alreadyPresent = content.split('\n').some((line) => {
      const trimmed = line.trim();
      return trimmed === projectName || trimmed === entryWithSlash;
    });
    if (alreadyPresent) return false;

    const suffix = content.length === 0 || content.endsWith('\n') ? '' : '\n';
    writeFileSync(gitignorePath, `${content}${suffix}${entryWithSlash}\n`);
    return true;
  } catch {
    return false;
  }
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
          // spec 0.13: retained 'area_of_focus' path_root key for backward-compat
          // in BootstrapConfig only — config still routes existing non-code roots.
          if (type !== 'project' && type !== 'non_code_project' && type !== 'area_of_focus') {
            throw new RegistryError(
              'INVALID_INPUT',
              `Invalid project type '${type}' in path_roots. Must be 'project' or 'non_code_project'.`,
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
      // Spec 0.26 path: project_type_id drives bootstrap from the user-managed
      // project_types table. Default_directory and git_init come from the
      // referenced row. No bootstrap-level config required.
      let pathRootKey: string;
      let dbType: ProjectType = 'project';
      let isCodeProject: boolean;
      let typeRoot: string | null = null;
      let projectTypeId: number | null = null;

      if (opts.project_type_id !== undefined) {
        const trow = db.prepare(
          `SELECT id, name, default_directory, git_init FROM project_types WHERE id = ?`
        ).get(opts.project_type_id) as
          { id: number; name: string; default_directory: string; git_init: number } | undefined;
        if (!trow) throw new InvalidProjectTypeError(opts.project_type_id);
        projectTypeId = trow.id;
        typeRoot = expandHome(trow.default_directory);
        isCodeProject = trow.git_init === 1;
        pathRootKey = trow.name; // for template-subdir lookup
      } else {
        // Legacy spec 0.13 path: BootstrapConfig path_roots must be configured.
        const config = this._getConfig(db);
        if (Object.keys(config.path_roots).length === 0) {
          throw new BootstrapNotConfiguredError();
        }
        const resolved = resolveBootstrapType(opts.type ?? 'project');
        pathRootKey = resolved.pathRootKey;
        dbType = resolved.dbType;
        isCodeProject = resolved.isCodeProject;
        typeRoot = config.path_roots[pathRootKey] ?? null;
      }

      const config = this._getConfig(db);

      // Resolve target path
      let targetPath: string;
      if (opts.path_override) {
        targetPath = opts.path_override;
      } else {
        if (!typeRoot) {
          throw new RegistryError(
            'BOOTSTRAP_NOT_CONFIGURED',
            `No path root configured for type '${pathRootKey}'.`,
            `Call configure_bootstrap to set a path root for '${pathRootKey}', or pass project_type_id.`,
          );
        }
        targetPath = join(typeRoot, opts.name);
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
          const templateSubdir = this._resolveTemplateSubdir(config.template_dir, pathRootKey);
          if (templateSubdir && existsSync(templateSubdir)) {
            cpSync(templateSubdir, targetPath, { recursive: true });
            templatesApplied = true;
          }
        }

        // Git init for code projects (unless skip_git)
        if (isCodeProject && !opts.skip_git) {
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
          type: dbType,
          status: opts.status ?? 'active',
          description: opts.description ?? '',
          goals: opts.goals ?? '',
          display_name: opts.display_name,
          paths: [targetPath],
          producer: opts.producer ?? 'bootstrap',
          area: opts.area ?? undefined,
          parent_project: opts.parent_project ?? undefined,
          // Spec 0.29: persist email_account when supplied via bootstrap.
          email_account: opts.email_account ?? null,
        });

        // Spec 0.26: stamp project_type_id onto the new row (the public
        // register() API doesn't take it yet, so write it here).
        if (projectTypeId != null) {
          db.prepare(
            `UPDATE projects SET project_type_id = ?, updated_at = datetime('now') WHERE name = ?`
          ).run(projectTypeId, opts.name);
        }
      } catch (err) {
        // Atomicity: clean up folder if something failed after creation
        try {
          rmSync(targetPath, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup
        }
        throw err;
      }

      const parentGitignoreUpdated = maybeUpdateParentGitignore(targetPath);

      return {
        name: opts.name,
        path: targetPath,
        type: dbType,
        git_initialized: gitInitialized,
        templates_applied: templatesApplied,
        parent_gitignore_updated: parentGitignoreUpdated,
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

  private _resolveTemplateSubdir(templateDir: string, type: string): string | null {
    // Look for type-specific subdirectory first
    const typeMap: Record<string, string[]> = {
      project: ['code-repo', 'project', 'code_project'],
      non_code_project: ['non_code_project', 'non-code', 'project'],
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

  // -------------------------------------------------------------------------
  // Spec 0.28: recipe-driven bootstrap.
  //
  // bootstrapWithRecipe runs the user-composable recipe attached to a
  // project type. The recipe is snapshotted at start (S151 — the snapshot
  // is the recipe-of-record for this attempt; mid-flight edits to the
  // type's recipe do not affect this attempt's Retry). On success, the
  // engine runs the structural register-in-registry trailer. On failure,
  // returns a BootstrapPendingState the caller resolves with retry/skip/
  // abandon.
  // -------------------------------------------------------------------------

  /**
   * Recipe-driven bootstrap (spec 0.28). Drives folder creation, template
   * copy, git init, parent .gitignore append, and any user-authored steps
   * through the configured recipe for the project type. Returns a
   * BootstrapEnvelope: success, pending (failed mid-run, awaiting
   * Retry/Skip/Abandon), pre-flight failure, or dry-run trace.
   */
  async bootstrapWithRecipe(opts: BootstrapProjectOpts): Promise<BootstrapEnvelope> {
    if (opts.project_type_id === undefined) {
      throw new RegistryError(
        'INVALID_INPUT',
        'bootstrapWithRecipe requires project_type_id (spec 0.28).',
        'Pass project_type_id from the user-managed project_types table.',
      );
    }

    const db = this.open();
    let typeRow:
      | { id: number; name: string; default_directory: string; git_init: number; template_directory: string | null }
      | undefined;
    try {
      typeRow = db.prepare(
        `SELECT id, name, default_directory, git_init, template_directory FROM project_types WHERE id = ?`,
      ).get(opts.project_type_id) as typeof typeRow;
    } finally {
      db.close();
    }
    if (!typeRow) throw new InvalidProjectTypeError(opts.project_type_id);

    // Resolve target path the same way the legacy path does.
    const typeRoot = expandHome(typeRow.default_directory);
    const targetPath = opts.path_override ?? join(typeRoot, opts.name);

    // Build the project context the runner uses for token resolution.
    // Spec 0.29: email_account drives mail-create-mailbox; per-type defaults
    // arrive via the recipe-step binding's `|fallback` syntax in templates.ts,
    // not via context state, so the context only carries the project value.
    const project: ProjectContext = {
      name: opts.name,
      path: targetPath,
      type: typeRow.name,
      parent_path: dirname(targetPath),
      template_directory: typeRow.template_directory,
      email_account: opts.email_account ?? null,
    };

    // Snapshot the recipe for this attempt (S151).
    const conn = this.open();
    let snapshot: RecipeSnapshot;
    try {
      snapshot = snapshotRecipe(conn, opts.project_type_id);
    } finally {
      conn.close();
    }

    // Dry-run path (S148): no side effects, no registration.
    if (opts.dry_run) {
      const env = await walkRecipe({
        snapshot,
        project,
        mcp_caller: opts.mcp_caller,
        dry_run: true,
      });
      return {
        kind: 'dry-run',
        name: opts.name,
        path: targetPath,
        steps: env.steps.map((s) => {
          const pre = env.preflight.steps.find((p) => p.position === s.position);
          return {
            position: s.position,
            primitive_name: s.primitive_name,
            shape: s.shape,
            resolved_params: s.resolved_params,
            preflight_ok: pre?.ok ?? true,
            preflight_reason: pre?.reason,
          };
        }),
      };
    }

    // Pre-flight first — common-sense guard against double-registration.
    // If the project name is already registered, fail fast before running
    // the recipe. (The recipe runner does not know about the registry.)
    const registry = new Registry(this._dbPath);
    if (registry.getProject(opts.name)) {
      throw new RegistryError(
        'DUPLICATE',
        `A project named '${opts.name}' is already registered.`,
        `Use update_project() to modify it, or choose a different name.`,
      );
    }
    if (existsSync(targetPath)) {
      // Surface as pre-flight failure rather than throw — keeps behavior
      // consistent with how the runner reports filesystem-op failures.
      return {
        kind: 'pre-flight-failed',
        name: opts.name,
        preflight_failures: [
          {
            position: 0,
            primitive_name: 'create-folder',
            reason: `target folder already exists: ${targetPath}`,
          },
        ],
      };
    }

    // Run the recipe.
    const env = await walkRecipe({
      snapshot,
      project,
      mcp_caller: opts.mcp_caller,
    });

    if (env.status === 'pre-flight-failed') {
      return {
        kind: 'pre-flight-failed',
        name: opts.name,
        preflight_failures: env.preflight.steps
          .filter((s) => !s.ok)
          .map((s) => ({
            position: s.position,
            primitive_name: s.primitive_name,
            reason: s.reason ?? 'unknown pre-flight failure',
          })),
      };
    }

    if (env.status === 'failed') {
      return {
        kind: 'pending',
        name: opts.name,
        path: targetPath,
        project_type_id: opts.project_type_id,
        snapshot,
        executed_steps: this._toExecutedSteps(env.steps),
        failed_at: env.failed_at!,
        error_output:
          env.steps.find((s) => s.status === 'failed')?.error_output ?? 'unknown failure',
        cleanup: env.cleanup,
        original_opts: opts,
      };
    }

    // Success: run the trailer (register-in-registry).
    return this._finishBootstrap(opts, project, snapshot, env);
  }

  /**
   * Resume a pending bootstrap with Retry (S145). Re-runs the failed step
   * plus all subsequent steps; previously-succeeded steps (including
   * mcp-tool/shell-command with side effects) are NOT re-invoked.
   */
  async retryBootstrap(pending: BootstrapPendingState): Promise<BootstrapEnvelope> {
    const project: ProjectContext = {
      name: pending.original_opts.name,
      path: pending.path,
      type: pending.snapshot.steps[0]?.primitive ? this._typeName(pending.project_type_id) : '',
      parent_path: dirname(pending.path),
      template_directory: this._typeTemplateDir(pending.project_type_id),
      email_account: pending.original_opts.email_account ?? null,
    };

    const env = await resumeWalk({
      snapshot: pending.snapshot,
      project,
      mcp_caller: pending.original_opts.mcp_caller,
      succeeded_so_far: pending.executed_steps
        .filter((s) => s.status === 'succeeded')
        .map((s) => this._toStepResult(s)),
      resume_from: pending.failed_at,
    });

    return this._envelopeFromResume(env, pending, project);
  }

  /**
   * Resume a pending bootstrap with Skip (S146). The failed step is
   * marked skipped; the engine continues with the next step.
   */
  async skipFailedAndContinue(pending: BootstrapPendingState): Promise<BootstrapEnvelope> {
    const project: ProjectContext = {
      name: pending.original_opts.name,
      path: pending.path,
      type: this._typeName(pending.project_type_id),
      parent_path: dirname(pending.path),
      template_directory: this._typeTemplateDir(pending.project_type_id),
      email_account: pending.original_opts.email_account ?? null,
    };

    const env = await resumeWalk({
      snapshot: pending.snapshot,
      project,
      mcp_caller: pending.original_opts.mcp_caller,
      succeeded_so_far: pending.executed_steps
        .filter((s) => s.status === 'succeeded')
        .map((s) => this._toStepResult(s)),
      resume_from: pending.failed_at,
      skip_failed: true,
    });

    return this._envelopeFromResume(env, pending, project);
  }

  /**
   * Resolve a pending bootstrap with Abandon (S147). Undoes the
   * filesystem and git work the engine itself performed, leaves
   * external side effects in place, and returns a labelled report.
   */
  abandonBootstrap(pending: BootstrapPendingState): {
    kind: 'abandoned';
    cleaned_up: string[];
    left_in_place: string[];
  } {
    const cleanedUp: string[] = [];
    const leftInPlace: string[] = [];

    // Revert parent .gitignore appends first (before removing the folder
    // — once the folder is gone the gitignore path may not be reachable).
    for (const append of pending.cleanup.gitignore_appends) {
      try {
        writeFileSync(append.path, append.original_content);
        cleanedUp.push(`Reverted ${append.path}`);
      } catch (err) {
        leftInPlace.push(`Could not revert ${append.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Remove .git directories the runner inited (defensive — they may
    // be inside the project folder we're about to remove).
    for (const repo of pending.cleanup.inited_git_repos) {
      const gitDir = join(repo, '.git');
      try {
        if (existsSync(gitDir)) rmSync(gitDir, { recursive: true, force: true });
        cleanedUp.push(`Removed git repository at ${repo}`);
      } catch (err) {
        leftInPlace.push(`Could not remove git repo at ${repo}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Remove project folders the runner created.
    for (const folder of pending.cleanup.created_folders) {
      try {
        if (existsSync(folder)) rmSync(folder, { recursive: true, force: true });
        cleanedUp.push(`Removed folder ${folder}`);
      } catch (err) {
        leftInPlace.push(`Could not remove ${folder}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // External side effects (mcp-tool, shell-command) are NOT undone
    // (#hard-constraints 4.3 / S147 — engine cannot unilaterally undo
    // external API calls).
    for (const ext of pending.cleanup.external_side_effects) {
      leftInPlace.push(`Left in place: ${ext.label} (clean up manually if needed)`);
    }

    // Note: register-in-registry never ran for a pending bootstrap, so
    // no registry row exists to clean up (verified by the contract that
    // the trailer is the LAST step).
    return { kind: 'abandoned', cleaned_up: cleanedUp, left_in_place: leftInPlace };
  }

  // -------------------------------------------------------------------------
  // Internal helpers for the recipe path.
  // -------------------------------------------------------------------------

  private _typeName(projectTypeId: number): string {
    const db = this.open();
    try {
      const row = db.prepare(`SELECT name FROM project_types WHERE id = ?`).get(projectTypeId) as
        | { name: string }
        | undefined;
      return row?.name ?? '';
    } finally {
      db.close();
    }
  }

  private _typeTemplateDir(projectTypeId: number): string | null {
    const db = this.open();
    try {
      const row = db
        .prepare(`SELECT template_directory FROM project_types WHERE id = ?`)
        .get(projectTypeId) as { template_directory: string | null } | undefined;
      return row?.template_directory ?? null;
    } finally {
      db.close();
    }
  }

  private _toExecutedSteps(steps: StepResult[]): ExecutedStep[] {
    return steps.map((s) => ({
      position: s.position,
      name: s.primitive_name,
      shape: s.shape,
      status: s.status as ExecutedStep['status'],
      output: s.output,
      error_output: s.error_output,
    }));
  }

  private _toStepResult(s: ExecutedStep): StepResult {
    return {
      position: s.position,
      primitive_id: null,
      primitive_name: s.name,
      shape: s.shape,
      status: s.status,
      resolved_params: {},
      output: s.output,
      error_output: s.error_output,
    };
  }

  private async _envelopeFromResume(
    env: RunnerEnvelope,
    pending: BootstrapPendingState,
    project: ProjectContext,
  ): Promise<BootstrapEnvelope> {
    if (env.status === 'pre-flight-failed') {
      return {
        kind: 'pre-flight-failed',
        name: pending.original_opts.name,
        preflight_failures: env.preflight.steps
          .filter((s) => !s.ok)
          .map((s) => ({
            position: s.position,
            primitive_name: s.primitive_name,
            reason: s.reason ?? 'unknown pre-flight failure',
          })),
      };
    }
    if (env.status === 'failed') {
      // Merge the resumed cleanup into the prior cleanup log (folders
      // already created on the first attempt remain tracked).
      const merged: CleanupLog = {
        created_folders: [...pending.cleanup.created_folders, ...env.cleanup.created_folders],
        inited_git_repos: [...pending.cleanup.inited_git_repos, ...env.cleanup.inited_git_repos],
        gitignore_appends: [...pending.cleanup.gitignore_appends, ...env.cleanup.gitignore_appends],
        external_side_effects: [
          ...pending.cleanup.external_side_effects,
          ...env.cleanup.external_side_effects,
        ],
      };
      return {
        kind: 'pending',
        name: pending.original_opts.name,
        path: pending.path,
        project_type_id: pending.project_type_id,
        snapshot: pending.snapshot,
        executed_steps: this._toExecutedSteps(env.steps),
        failed_at: env.failed_at!,
        error_output:
          env.steps.find((s) => s.status === 'failed')?.error_output ?? 'unknown failure',
        cleanup: merged,
        original_opts: pending.original_opts,
      };
    }
    return this._finishBootstrap(pending.original_opts, project, pending.snapshot, env);
  }

  /**
   * Run the structural register-in-registry trailer and assemble the
   * final BootstrapResult envelope. Called by both the first-attempt
   * success path and the resume-success path.
   */
  private _finishBootstrap(
    opts: BootstrapProjectOpts,
    project: ProjectContext,
    _snapshot: RecipeSnapshot,
    env: RunnerEnvelope,
  ): BootstrapEnvelope {
    const registry = new Registry(this._dbPath);
    try {
      registry.register({
        name: opts.name,
        type: 'project',
        status: opts.status ?? 'active',
        description: opts.description ?? '',
        goals: opts.goals ?? '',
        display_name: opts.display_name,
        paths: [project.path],
        producer: opts.producer ?? 'bootstrap',
        area: opts.area ?? undefined,
        parent_project: opts.parent_project ?? undefined,
        // Spec 0.29: persist the bootstrap-time email_account on the
        // project row so a subsequent get_project surfaces it (S155).
        email_account: opts.email_account ?? null,
      });

      // Stamp project_type_id (Registry.register doesn't accept it directly).
      if (opts.project_type_id != null) {
        const db = this.open();
        try {
          db.prepare(
            `UPDATE projects SET project_type_id = ?, updated_at = datetime('now') WHERE name = ?`,
          ).run(opts.project_type_id, opts.name);
        } finally {
          db.close();
        }
      }
    } catch (err) {
      // Registration failed — surface as a final failed step (the trailer
      // becomes the failure point). Cleanup is the caller's call.
      const trailerIdx = env.steps.length - 1;
      env.steps[trailerIdx] = {
        ...env.steps[trailerIdx],
        status: 'failed',
        error_output: err instanceof Error ? err.message : String(err),
      };
      return {
        kind: 'pending',
        name: opts.name,
        path: project.path,
        project_type_id: opts.project_type_id!,
        snapshot: _snapshot,
        executed_steps: this._toExecutedSteps(env.steps),
        failed_at: trailerIdx,
        error_output: err instanceof Error ? err.message : String(err),
        cleanup: env.cleanup,
        original_opts: opts,
      };
    }

    // Patch the trailer status to succeeded.
    const trailerIdx = env.steps.length - 1;
    env.steps[trailerIdx] = { ...env.steps[trailerIdx], status: 'succeeded' };

    // Convenience flags — true when the corresponding built-in ran successfully.
    const ranSuccessfully = (key: string): boolean =>
      env.steps.some((s) => {
        // We can't read primitive_id on the way back from the runner
        // because the trailer has primitive_id=null; match by primitive_name
        // against the seeded built-in display names.
        return s.status === 'succeeded' && s.primitive_name === key;
      });

    return {
      kind: 'success',
      name: opts.name,
      path: project.path,
      type: 'project',
      git_initialized: ranSuccessfully('Git init'),
      templates_applied: ranSuccessfully('Copy template'),
      parent_gitignore_updated: ranSuccessfully('Update parent .gitignore'),
      executed_steps: this._toExecutedSteps(env.steps),
    };
  }
}
