// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: recipe walker — orchestrates pre-flight + step execution.
//
// The walker:
//   1. Resolves every step's params against the project context.
//   2. Calls each executor's preflight() for the structural ✓/✗ trace
//      (S143). Pre-flight runs over EVERY step before any execute() runs.
//   3. If pre-flight passes for all steps, executes each step in order
//      (S142). On step failure, returns immediately with status 'failed'
//      and `failed_at` set — the caller decides Retry/Skip/Abandon (S144).
//   4. The structural register-in-registry trailer is NOT executed here —
//      Chunk 4's bootstrap engine wires that in after the walker returns
//      success (and rolls back via cleanup on Abandon).

import type { Primitive, RecipeSnapshot, RecipeStep } from './types.js';
import type {
  ExecutorContext,
  PreflightEnvelope,
  PreflightResult,
  RunnerEnvelope,
  ShapeExecutor,
  StepResult,
} from './runner.js';
import { newCleanupLog, TRAILER_LABEL, TRAILER_NAME } from './runner.js';
import { resolveParams, type ProjectContext } from './templates.js';
import { filesystemExecutor } from './executors/filesystem.js';
import { shellExecutor } from './executors/shell.js';
import { mcpExecutor } from './executors/mcp.js';
import type { McpToolCaller } from './mcp-caller.js';

/** Map a primitive's shape to its executor. */
export function pickExecutor(primitive: Primitive): ShapeExecutor {
  switch (primitive.shape) {
    case 'filesystem-op':
      return filesystemExecutor;
    case 'shell-command':
      return shellExecutor;
    case 'mcp-tool':
      return mcpExecutor;
    default: {
      // Defensive — should be unreachable given the schema CHECK constraint.
      const exhaustive: never = primitive.shape;
      throw new Error(`unknown primitive shape: ${exhaustive as string}`);
    }
  }
}

export interface WalkOpts {
  snapshot: RecipeSnapshot;
  project: ProjectContext;
  /** Optional MCP caller — required when the recipe contains mcp-tool steps. */
  mcp_caller?: McpToolCaller;
  /**
   * When true, every step's status is set to 'not-run' and execute() is NOT
   * called — used by Dry run / Preview (S148, S149) to render the trace
   * without side effects.
   */
  dry_run?: boolean;
}

/**
 * Run pre-flight over every step in the snapshot. Returns one result per
 * recipe step plus the trailer at the end. The walker calls this before
 * deciding to execute (or as the only operation in dry-run).
 */
export async function preflight(opts: WalkOpts): Promise<PreflightEnvelope> {
  const steps: PreflightResult[] = [];

  for (const step of opts.snapshot.steps) {
    const executor = pickExecutor(step.primitive);
    // Resolve this step's params first; if resolution fails, the step is
    // pre-flight ✗ regardless of executor logic.
    const resolved = resolveParams(step.params, opts.project);
    const baseCtx: ExecutorContext = {
      project: opts.project,
      resolved_params: resolved.ok ? resolved.values : step.params,
      mcp_caller: opts.mcp_caller,
    };
    if (!resolved.ok) {
      steps.push({
        position: step.position,
        primitive_name: step.primitive.name,
        shape: step.primitive.shape,
        ok: false,
        reason: `unresolved template token in parameter '${resolved.key}': {${resolved.failure.token}}`,
        resolved_params: step.params,
      });
      continue;
    }
    const r = await executor.preflight(step.primitive, baseCtx);
    r.position = step.position;
    steps.push(r);
  }

  // Trailer pre-flight is always ✓ — registration is internal and depends
  // only on a writable database, which the engine has by construction.
  steps.push({
    position: opts.snapshot.steps.length,
    primitive_name: TRAILER_NAME,
    shape: 'register-in-registry',
    ok: true,
    resolved_params: {},
  });

  return {
    ok: steps.every((s) => s.ok),
    steps,
  };
}

/**
 * Walk the recipe: pre-flight, then execute. The trailer is NOT invoked
 * here — the caller (Bootstrap engine) runs it on success after the
 * walker returns.
 *
 * On dry-run, no executor.execute() is called; every step's status is
 * 'not-run' and the trace is built from preflight + resolved params.
 */
export async function walkRecipe(opts: WalkOpts): Promise<RunnerEnvelope> {
  const cleanup = newCleanupLog();
  const pre = await preflight(opts);

  // Dry-run path: render the trace from pre-flight + resolved params.
  if (opts.dry_run) {
    const steps: StepResult[] = opts.snapshot.steps.map((s, i) => {
      const preflightStep = pre.steps[i];
      return {
        position: s.position,
        primitive_id: s.primitive.id,
        primitive_name: s.primitive.name,
        shape: s.primitive.shape,
        status: 'not-run',
        resolved_params: preflightStep?.resolved_params ?? s.params,
      };
    });
    // Trailer placeholder.
    steps.push({
      position: opts.snapshot.steps.length,
      primitive_id: null,
      primitive_name: TRAILER_LABEL,
      shape: 'register-in-registry',
      status: 'not-run',
      resolved_params: {},
    });
    return {
      status: pre.ok ? 'succeeded' : 'pre-flight-failed',
      snapshot: opts.snapshot,
      preflight: pre,
      steps,
      cleanup,
    };
  }

  if (!pre.ok) {
    // Pre-flight failure: no side effects, no execute calls.
    const steps: StepResult[] = opts.snapshot.steps.map((s, i) => ({
      position: s.position,
      primitive_id: s.primitive.id,
      primitive_name: s.primitive.name,
      shape: s.primitive.shape,
      status: 'not-run',
      resolved_params: pre.steps[i]?.resolved_params ?? s.params,
    }));
    steps.push({
      position: opts.snapshot.steps.length,
      primitive_id: null,
      primitive_name: TRAILER_LABEL,
      shape: 'register-in-registry',
      status: 'not-run',
      resolved_params: {},
    });
    return {
      status: 'pre-flight-failed',
      snapshot: opts.snapshot,
      preflight: pre,
      steps,
      cleanup,
    };
  }

  // Execute phase.
  const executed: StepResult[] = [];
  let failedAt: number | undefined;

  for (const step of opts.snapshot.steps) {
    const executor = pickExecutor(step.primitive);
    const preflightForStep = pre.steps[step.position];
    const ctx: ExecutorContext = {
      project: opts.project,
      resolved_params: preflightForStep?.resolved_params ?? step.params,
      mcp_caller: opts.mcp_caller,
      cleanup_log: cleanup,
    };
    const result = await executor.execute(step.primitive, step, ctx);
    executed.push(result);
    if (result.status === 'failed') {
      failedAt = step.position;
      break;
    }
  }

  // Append 'not-run' rows for any step we never reached (after a failure).
  if (failedAt !== undefined) {
    for (const step of opts.snapshot.steps) {
      if (step.position > failedAt) {
        executed.push({
          position: step.position,
          primitive_id: step.primitive.id,
          primitive_name: step.primitive.name,
          shape: step.primitive.shape,
          status: 'not-run',
          resolved_params: pre.steps[step.position]?.resolved_params ?? step.params,
        });
      }
    }
    executed.push({
      position: opts.snapshot.steps.length,
      primitive_id: null,
      primitive_name: TRAILER_LABEL,
      shape: 'register-in-registry',
      status: 'not-run',
      resolved_params: {},
    });
    return {
      status: 'failed',
      snapshot: opts.snapshot,
      preflight: pre,
      steps: executed,
      failed_at: failedAt,
      cleanup,
    };
  }

  // All steps succeeded. The trailer is left as 'pending' — the caller
  // (Bootstrap engine) will execute it and patch the status.
  executed.push({
    position: opts.snapshot.steps.length,
    primitive_id: null,
    primitive_name: TRAILER_LABEL,
    shape: 'register-in-registry',
    status: 'pending',
    resolved_params: {},
  });

  return {
    status: 'succeeded',
    snapshot: opts.snapshot,
    preflight: pre,
    steps: executed,
    cleanup,
  };
}

/**
 * Resume a walk from a specific step (for Retry — S145). Skips every
 * `succeeded` step in the prior envelope and restarts from `failed_at`.
 *
 * The caller passes the prior envelope's steps array as `succeeded_so_far`;
 * we mark those as `succeeded (not re-run)` in the returned envelope and
 * execute everything from `failed_at` onward.
 */
export async function resumeWalk(
  opts: WalkOpts & {
    succeeded_so_far: StepResult[];
    resume_from: number;
    /**
     * When true (the Skip control — S146), the failed step itself is
     * marked `skipped` and the walk continues from the next step.
     */
    skip_failed?: boolean;
  },
): Promise<RunnerEnvelope> {
  const cleanup = newCleanupLog();
  const pre = await preflight(opts);

  // Pre-flight must still pass at the resumption point — the caller
  // already fixed the underlying cause.
  if (!pre.ok) {
    return {
      status: 'pre-flight-failed',
      snapshot: opts.snapshot,
      preflight: pre,
      steps: opts.succeeded_so_far,
      cleanup,
    };
  }

  const executed: StepResult[] = [];
  // Carry the prior succeeded steps forward (not re-run, per S145/S153).
  for (const prior of opts.succeeded_so_far) {
    if (prior.status === 'succeeded') {
      executed.push({
        ...prior,
        output: prior.output
          ? `${prior.output} (not re-run)`
          : `(succeeded on prior attempt; not re-run)`,
      });
    }
  }

  let failedAt: number | undefined;
  let startIndex = opts.snapshot.steps.findIndex((s) => s.position === opts.resume_from);
  if (startIndex < 0) startIndex = 0;

  // Skip-the-failed-step branch.
  if (opts.skip_failed) {
    const skipped = opts.snapshot.steps[startIndex];
    if (skipped) {
      executed.push({
        position: skipped.position,
        primitive_id: skipped.primitive.id,
        primitive_name: skipped.primitive.name,
        shape: skipped.primitive.shape,
        status: 'skipped',
        resolved_params: pre.steps[skipped.position]?.resolved_params ?? skipped.params,
        output: 'Skipped by user',
      });
      startIndex += 1;
    }
  }

  for (let i = startIndex; i < opts.snapshot.steps.length; i++) {
    const step = opts.snapshot.steps[i];
    const executor = pickExecutor(step.primitive);
    const preflightForStep = pre.steps[step.position];
    const ctx: ExecutorContext = {
      project: opts.project,
      resolved_params: preflightForStep?.resolved_params ?? step.params,
      mcp_caller: opts.mcp_caller,
      cleanup_log: cleanup,
    };
    const result = await executor.execute(step.primitive, step, ctx);
    executed.push(result);
    if (result.status === 'failed') {
      failedAt = step.position;
      break;
    }
  }

  if (failedAt !== undefined) {
    // Add 'not-run' for everything after the failure + trailer.
    for (const step of opts.snapshot.steps) {
      if (step.position > failedAt) {
        executed.push({
          position: step.position,
          primitive_id: step.primitive.id,
          primitive_name: step.primitive.name,
          shape: step.primitive.shape,
          status: 'not-run',
          resolved_params: pre.steps[step.position]?.resolved_params ?? step.params,
        });
      }
    }
    executed.push({
      position: opts.snapshot.steps.length,
      primitive_id: null,
      primitive_name: TRAILER_LABEL,
      shape: 'register-in-registry',
      status: 'not-run',
      resolved_params: {},
    });
    return {
      status: 'failed',
      snapshot: opts.snapshot,
      preflight: pre,
      steps: executed,
      failed_at: failedAt,
      cleanup,
    };
  }

  executed.push({
    position: opts.snapshot.steps.length,
    primitive_id: null,
    primitive_name: TRAILER_LABEL,
    shape: 'register-in-registry',
    status: 'pending',
    resolved_params: {},
  });

  return {
    status: 'succeeded',
    snapshot: opts.snapshot,
    preflight: pre,
    steps: executed,
    cleanup,
  };
}
