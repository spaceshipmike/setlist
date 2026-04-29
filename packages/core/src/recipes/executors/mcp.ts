// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: mcp-tool shape executor.
//
// Delegates to a tool registered with the host MCP client (Claude Code,
// Claude Desktop, or any other MCP host). Setlist forwards the call
// through the injected McpToolCaller; auth, networking, and rate limits
// live in the MCP server itself (#hard-constraints 4.3).
//
// Pre-flight (S143): verify the named tool is currently registered with
// the active MCP session by checking listAvailableTools(). When the host
// is not connected (NULL_MCP_CALLER), pre-flight fails with a clear
// "no host MCP client connected" message.

import type { Primitive, RecipeStep, McpToolDefinition } from '../types.js';
import type {
  ExecutorContext,
  PreflightResult,
  ShapeExecutor,
  StepResult,
} from '../runner.js';
import { resolveParams } from '../templates.js';

export const mcpExecutor: ShapeExecutor = {
  async preflight(primitive: Primitive, ctx: ExecutorContext): Promise<PreflightResult> {
    const def = primitive.definition as McpToolDefinition;
    const params = ctx.resolved_params;
    const result: PreflightResult = {
      position: -1,
      primitive_name: primitive.name,
      shape: 'mcp-tool',
      ok: true,
      resolved_params: params,
    };

    if (!def.toolName || def.toolName.trim() === '') {
      result.ok = false;
      result.reason = 'mcp-tool primitive has no toolName configured';
      return result;
    }

    if (!ctx.mcp_caller) {
      result.ok = false;
      result.reason = `no host MCP client connected — tool '${def.toolName}' not reachable`;
      return result;
    }

    let tools;
    try {
      tools = await ctx.mcp_caller.listAvailableTools();
    } catch (err) {
      result.ok = false;
      result.reason = `MCP host failed to enumerate tools: ${err instanceof Error ? err.message : String(err)}`;
      return result;
    }

    const found = tools.some((t) => t.name === def.toolName);
    if (!found) {
      result.ok = false;
      result.reason = `MCP tool '${def.toolName}' is not currently registered with the host session`;
    }
    return result;
  },

  async execute(primitive: Primitive, step: RecipeStep, ctx: ExecutorContext): Promise<StepResult> {
    const def = primitive.definition as McpToolDefinition;
    const params = ctx.resolved_params;
    const startedAt = new Date().toISOString();
    const base: StepResult = {
      position: step.position,
      primitive_id: primitive.id,
      primitive_name: primitive.name,
      shape: 'mcp-tool',
      status: 'pending',
      resolved_params: params,
      started_at: startedAt,
    };

    if (!ctx.mcp_caller) {
      base.status = 'failed';
      base.error_output = `no host MCP client connected — cannot invoke '${def.toolName}'`;
      base.completed_at = new Date().toISOString();
      return base;
    }

    // The recipe-step's resolved params ARE the tool's argument map
    // (the user authored them as such in Settings). Pass them through.
    const result = await ctx.mcp_caller.callTool(def.toolName, params);
    if (result.ok) {
      base.status = 'succeeded';
      base.output = result.summary ?? `Called ${def.toolName} successfully`;
      // Spec 0.29: structured external-side-effect entry (S162). MCP tool
      // side effects (Todoist project created, gh repo created, etc.) are
      // not auto-undone — Abandon lists them in the cleanup report.
      if (ctx.cleanup_log) {
        ctx.cleanup_log.external_side_effects.push({
          step: step.position + 1,
          primitive: primitive.name,
          summary: result.summary ?? `MCP tool: ${def.toolName}`,
        });
      }
    } else {
      base.status = 'failed';
      base.error_output = result.error;
    }
    base.completed_at = new Date().toISOString();
    return base;
  },
};

/**
 * Resolve mcp-tool params via the standard template resolver. Exposed for
 * testing — the runner already calls resolveParams before dispatching to
 * the executor.
 */
export { resolveParams };
