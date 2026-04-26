// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: shell-command shape executor.
//
// Runs a verbatim command string under the user's shell, in the project
// folder, inheriting the user's normal environment (PATH, keychain, gh
// auth, op session, etc.). Setlist does not sandbox, does not strip env,
// does not inject managed credentials. Exit code zero is success; non-zero
// is failure (S152).
//
// The git-init built-in is the canonical shell-command primitive. The
// command is sourced from the primitive's definition (`def.command`); the
// recipe step's params may override the working_directory binding.
//
// Pre-flight checks: the first token of the command (after stripping
// leading shell modifiers like `cd path && `) is a binary on PATH. This
// catches "binary not installed" before any side effect runs.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Primitive, RecipeStep, ShellCommandDefinition } from '../types.js';
import type {
  ExecutorContext,
  PreflightResult,
  ShapeExecutor,
  StepResult,
} from '../runner.js';
import { resolveTemplate } from '../templates.js';

/**
 * Best-effort heuristic: extract the first executable token from a command
 * string for PATH presence check. Strips leading `cd ... && `, env-var
 * assignments (`FOO=bar `), and quotes. Returns null when the command is
 * empty or starts with a token we can't reliably extract (a shell builtin
 * like `if`, `for`, etc. — those are best-effort allowed through).
 */
export function firstBinary(command: string): string | null {
  let cmd = command.trim();
  // Strip a leading `cd path && ` chain.
  while (/^cd\s+[^&]+\s+&&\s+/.test(cmd)) {
    cmd = cmd.replace(/^cd\s+[^&]+\s+&&\s+/, '');
  }
  // Strip leading env-var assignments (FOO=bar ).
  cmd = cmd.replace(/^([A-Z_][A-Z0-9_]*=\S*\s+)+/i, '');
  // Take the first whitespace-separated token, stripping wrapping quotes.
  const m = cmd.match(/^([^\s|;&<>]+)/);
  if (!m) return null;
  let token = m[1];
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1);
  }
  // Shell builtins / control flow — allow through.
  const builtins = new Set([
    'if', 'for', 'while', 'case', 'function', 'return', 'export',
    'cd', 'echo', 'set', 'unset', 'source', '.', '[', ':',
    'exit', 'true', 'false', 'eval', 'exec', 'trap', 'wait', 'read',
    'shift', 'break', 'continue', 'declare', 'local', 'readonly',
  ]);
  if (builtins.has(token)) return null;
  return token;
}

/**
 * PATH lookup — true when `binary` is on PATH or is an absolute path that
 * exists. Mirrors `command -v` semantics for our pre-flight purposes.
 */
export function binaryOnPath(binary: string): boolean {
  if (binary.startsWith('/') || binary.startsWith('./') || binary.startsWith('../')) {
    return existsSync(binary);
  }
  const PATH = process.env.PATH ?? '';
  for (const dir of PATH.split(':')) {
    if (!dir) continue;
    if (existsSync(join(dir, binary))) return true;
  }
  return false;
}

export const shellExecutor: ShapeExecutor = {
  async preflight(primitive: Primitive, ctx: ExecutorContext): Promise<PreflightResult> {
    const def = primitive.definition as ShellCommandDefinition;
    const params = ctx.resolved_params;
    const result: PreflightResult = {
      position: -1,
      primitive_name: primitive.name,
      shape: 'shell-command',
      ok: true,
      resolved_params: params,
    };

    // Resolve command tokens against the project context (the runner
    // already resolved params; the command itself may also reference tokens).
    const resolved = resolveTemplate(def.command, ctx.project);
    if (!resolved.ok) {
      result.ok = false;
      result.reason = `unresolved template token in command: {${resolved.token}}`;
      return result;
    }
    const command = resolved.value;
    const binary = firstBinary(command);
    if (binary && !binaryOnPath(binary)) {
      result.ok = false;
      result.reason = `binary '${binary}' not on PATH`;
    }
    return result;
  },

  async execute(primitive: Primitive, step: RecipeStep, ctx: ExecutorContext): Promise<StepResult> {
    const def = primitive.definition as ShellCommandDefinition;
    const params = ctx.resolved_params;
    const startedAt = new Date().toISOString();
    const base: StepResult = {
      position: step.position,
      primitive_id: primitive.id,
      primitive_name: primitive.name,
      shape: 'shell-command',
      status: 'pending',
      resolved_params: params,
      started_at: startedAt,
    };

    const resolvedCmd = resolveTemplate(def.command, ctx.project);
    if (!resolvedCmd.ok) {
      base.status = 'failed';
      base.error_output = `unresolved template token in command: {${resolvedCmd.token}}`;
      base.completed_at = new Date().toISOString();
      return base;
    }
    const command = resolvedCmd.value;

    // Working directory: explicit param overrides the primitive's default.
    const cwd = params.working_directory ?? def.workingDirectory ?? ctx.project.path;
    const resolvedCwdResult = resolveTemplate(cwd, ctx.project);
    const cwdResolved = resolvedCwdResult.ok ? resolvedCwdResult.value : ctx.project.path;

    try {
      // Inherit the user's full environment (S152). No scrubbing, no
      // managed credentials, no privilege escalation.
      const stdout = execSync(command, {
        cwd: cwdResolved,
        stdio: 'pipe',
        env: process.env,
        encoding: 'utf8',
      });
      base.output = stdout.toString().trim() || `(exit 0; no output)`;
      base.status = 'succeeded';
      // Track for "left in place" semantic on Abandon (shell side effects
      // are not auto-undone).
      if (ctx.cleanup_log) {
        ctx.cleanup_log.external_side_effects.push({
          step_position: step.position,
          label: `${primitive.name} (shell command: ${command})`,
        });
      }
      // git-init special case: track the repo for Abandon cleanup so we can
      // remove the .git directory we created.
      if (primitive.builtin_key === 'git-init') {
        if (ctx.cleanup_log) {
          ctx.cleanup_log.inited_git_repos.push(cwdResolved);
        }
      }
    } catch (err) {
      base.status = 'failed';
      // execSync's errors carry stderr in `.stderr`; surface it verbatim.
      const errAny = err as { message?: string; stderr?: Buffer | string };
      const stderr =
        errAny.stderr instanceof Buffer
          ? errAny.stderr.toString()
          : typeof errAny.stderr === 'string'
            ? errAny.stderr
            : '';
      base.error_output = stderr.trim() || errAny.message || String(err);
    }
    base.completed_at = new Date().toISOString();
    return base;
  },
};
