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
 * Spec 0.29: substitute `{paramKey}` references in a command string with
 * the corresponding value from the recipe step's resolved params. Runs
 * BEFORE the project-token pass so a primitive's command can reference
 * recipe-step params (e.g., `{account}` and `{mailbox_path}` for the
 * mail-create-mailbox built-in). Tokens not in the params map are left
 * untouched — `resolveTemplate` then handles project.* tokens or fails
 * with `unknown-token`.
 */
function substituteParams(command: string, params: Record<string, string>): string {
  let out = command;
  for (const [key, value] of Object.entries(params)) {
    // Only substitute literal `{key}` (not `{name|fallback}` constructs —
    // those are project-token fallbacks the resolver handles separately).
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

/**
 * Spec 0.29 (S162): mail-create-mailbox external-side-effect summary —
 * the user-visible line that appears in Abandon's "Left in place" report.
 * Names the account and resolved mailbox path so the user can clean up
 * manually in Mail.app's UI.
 */
function formatMailboxSummary(params: Record<string, string>): string {
  const account = params.account ?? '?';
  const path = params.mailbox_path ?? '?';
  return `Mail.app account '${account}' has new mailbox '${path}'`;
}

/**
 * Spec 0.29 (S159): Mail.app process probe. Read-only check via
 * `pgrep -x Mail` — does NOT launch the application. Returns true when
 * Mail.app is running, false otherwise. Used by the pre-flight hook on
 * the mail-create-mailbox built-in.
 */
function isMailAppRunning(): boolean {
  try {
    // pgrep exits 0 with matching pid on stdout when Mail is running, 1
    // otherwise. Suppress stderr so a missing pgrep on minimal systems
    // doesn't pollute the bootstrap trace.
    execSync('pgrep -x Mail', { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

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

    // Spec 0.29: substitute recipe-step params first ({account}, {mailbox_path}, etc.)
    // so the project-token pass below sees a clean string.
    const paramSubbed = substituteParams(def.command, params);
    // Resolve command tokens against the project context (the runner
    // already resolved params; the command itself may also reference tokens).
    const resolved = resolveTemplate(paramSubbed, ctx.project);
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
      return result;
    }

    // Spec 0.29 (S159): Mail.app process probe for mail-create-mailbox.
    // Pre-flight fails clean when Mail isn't running — no auto-launch.
    // Account-existence is NOT validated here (S159 satisfaction criterion);
    // an unknown account surfaces mid-run via the Retry/Skip/Abandon dialog.
    if (primitive.builtin_key === 'mail-create-mailbox' && !isMailAppRunning()) {
      result.ok = false;
      result.reason = 'Mail.app must be running to create a mailbox.';
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

    // Spec 0.29: substitute recipe-step params first ({account}, {mailbox_path}, etc.)
    // before the project-token pass — same order as preflight.
    const paramSubbed = substituteParams(def.command, params);
    const resolvedCmd = resolveTemplate(paramSubbed, ctx.project);
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
      // git-init special case: track the repo for Abandon cleanup so we can
      // remove the .git directory we created. Filesystem-undoable, NOT an
      // external side effect.
      if (primitive.builtin_key === 'git-init') {
        if (ctx.cleanup_log) {
          ctx.cleanup_log.inited_git_repos.push(cwdResolved);
        }
      } else if (ctx.cleanup_log) {
        // Spec 0.29: structured external-side-effect entry (S162). The
        // mail-create-mailbox primitive renders as a Mail.app mailbox line
        // the user can clean up manually; other shell-command primitives
        // get a generic "<command>" summary.
        const summary =
          primitive.builtin_key === 'mail-create-mailbox'
            ? formatMailboxSummary(params)
            : `shell command: ${command}`;
        ctx.cleanup_log.external_side_effects.push({
          step: step.position + 1,
          primitive: primitive.name,
          summary,
        });
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
