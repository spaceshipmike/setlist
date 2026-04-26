// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: filesystem-op shape executor.
//
// Three operations: create-folder, copy-template, append-to-file.
// All three are idempotent on retry (S153):
//   - create-folder uses mkdir -p — re-running on an existing folder is a
//     no-op, no clobber, no error.
//   - copy-template skips files that are already present at the destination.
//   - append-to-file checks line presence before appending — duplicate lines
//     are not appended.
//
// Pre-flight checks: source paths exist (when the operation reads from disk),
// no parameters resolve to empty when the operation needs a non-empty path.

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import type { Primitive, RecipeStep, FilesystemOpDefinition } from '../types.js';
import type {
  ExecutorContext,
  PreflightResult,
  ShapeExecutor,
  StepResult,
} from '../runner.js';

export const filesystemExecutor: ShapeExecutor = {
  async preflight(primitive: Primitive, ctx: ExecutorContext): Promise<PreflightResult> {
    const def = primitive.definition as FilesystemOpDefinition;
    const params = ctx.resolved_params;
    const result: PreflightResult = {
      position: -1, // filled by the walker
      primitive_name: primitive.name,
      shape: 'filesystem-op',
      ok: true,
      resolved_params: params,
    };

    switch (def.operation) {
      case 'create-folder': {
        const path = params.path;
        if (!path || path.trim() === '') {
          result.ok = false;
          result.reason = 'create-folder requires a non-empty `path` parameter';
        }
        break;
      }
      case 'copy-template': {
        const source = params.source;
        const destination = params.destination;
        if (!destination || destination.trim() === '') {
          result.ok = false;
          result.reason = 'copy-template requires a non-empty `destination` parameter';
          break;
        }
        // Empty source = no-op (matches v0.27 behavior when template_directory
        // is null). Pre-flight passes; execute is a no-op.
        if (source && source.trim() !== '' && !existsSync(source)) {
          result.ok = false;
          result.reason = `copy-template source path does not exist: ${source}`;
        }
        break;
      }
      case 'append-to-file': {
        const path = params.path;
        const line = params.line;
        if (!path || path.trim() === '') {
          result.ok = false;
          result.reason = 'append-to-file requires a non-empty `path` parameter';
          break;
        }
        if (line === undefined) {
          result.ok = false;
          result.reason = 'append-to-file requires a `line` parameter';
        }
        // Note: we DO NOT require the file to exist at pre-flight — the
        // update-parent-gitignore built-in is best-effort and silently
        // skips when the parent .gitignore is absent (matches v0.27).
        break;
      }
      default: {
        result.ok = false;
        result.reason = `unknown filesystem operation: ${(def as { operation: string }).operation}`;
      }
    }
    return result;
  },

  async execute(primitive: Primitive, step: RecipeStep, ctx: ExecutorContext): Promise<StepResult> {
    const def = primitive.definition as FilesystemOpDefinition;
    const params = ctx.resolved_params;
    const startedAt = new Date().toISOString();
    const base: StepResult = {
      position: step.position,
      primitive_id: primitive.id,
      primitive_name: primitive.name,
      shape: 'filesystem-op',
      status: 'pending',
      resolved_params: params,
      started_at: startedAt,
    };

    try {
      switch (def.operation) {
        case 'create-folder': {
          const path = params.path;
          const preexisted = existsSync(path);
          mkdirSync(path, { recursive: true });
          if (!preexisted && ctx.cleanup_log) {
            ctx.cleanup_log.created_folders.push(path);
          }
          base.output = preexisted
            ? `Folder already existed: ${path} (no-op)`
            : `Created folder: ${path}`;
          base.status = 'succeeded';
          break;
        }
        case 'copy-template': {
          const source = params.source;
          const destination = params.destination;
          if (!source || source.trim() === '') {
            base.status = 'succeeded';
            base.output = 'No template source bound (no-op)';
            break;
          }
          if (!existsSync(source)) {
            // Should have been caught by pre-flight, but be defensive.
            base.status = 'succeeded';
            base.output = `Template source missing at run time: ${source} (no-op)`;
            break;
          }
          // Idempotent: cpSync's `force: false` skips files that already exist
          // at the destination — no clobber on retry (S153).
          if (!existsSync(destination)) {
            mkdirSync(destination, { recursive: true });
          }
          cpSync(source, destination, { recursive: true, force: false, errorOnExist: false });
          base.output = `Copied template ${source} → ${destination}`;
          base.status = 'succeeded';
          break;
        }
        case 'append-to-file': {
          const path = params.path;
          const line = params.line;
          // Best-effort: if the file doesn't exist, we silently skip
          // (matches the v0.27 update-parent-gitignore semantic where the
          // parent .gitignore must already exist for an append to happen).
          if (!existsSync(path)) {
            base.output = `File does not exist: ${path} (no-op)`;
            base.status = 'succeeded';
            break;
          }
          const content = readFileSync(path, 'utf8');
          // Idempotent: line-presence check (S153). If the line is already
          // present (with or without trailing slash variants for the
          // gitignore use-case), we skip.
          const trimmedLine = line.trim();
          const trimmedNoSlash = trimmedLine.endsWith('/')
            ? trimmedLine.slice(0, -1)
            : trimmedLine;
          const present = content.split('\n').some((row) => {
            const t = row.trim();
            return t === trimmedLine || t === trimmedNoSlash || t === `${trimmedNoSlash}/`;
          });
          if (present) {
            base.output = `Line already present in ${path} (no-op)`;
            base.status = 'succeeded';
            break;
          }
          const original = content;
          const suffix = content.length === 0 || content.endsWith('\n') ? '' : '\n';
          writeFileSync(path, `${content}${suffix}${line}\n`);
          if (ctx.cleanup_log) {
            ctx.cleanup_log.gitignore_appends.push({ path, original_content: original });
          }
          base.output = `Appended "${line}" to ${path}`;
          base.status = 'succeeded';
          break;
        }
        default: {
          base.status = 'failed';
          base.error_output = `unknown filesystem operation: ${(def as { operation: string }).operation}`;
        }
      }
    } catch (err) {
      base.status = 'failed';
      base.error_output = err instanceof Error ? err.message : String(err);
    }
    base.completed_at = new Date().toISOString();
    return base;
  },
};

/** Test helper: get the directory entry stat (or null) for assertion purposes. */
export function statOrNull(p: string) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}
