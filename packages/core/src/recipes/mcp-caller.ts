// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: McpToolCaller interface.
//
// The runner doesn't talk to the host MCP client directly — it goes through
// an injected caller. This keeps @setlist/core free of MCP SDK dependencies
// and lets the MCP server (which has access to the live session) supply the
// tool list and per-call dispatcher.
//
// At pre-flight time the runner calls `listAvailableTools()` to verify a
// recipe's mcp-tool steps point at currently-registered tools (S143). At
// run time it calls `callTool(name, args)` to invoke the tool and observe
// the result (success / failure / error message).

export interface McpToolDescriptor {
  /** Fully-qualified tool name (e.g. `mcp__asst-tools__todoist_create_task`). */
  name: string;
  /** Short human-readable description, when available. */
  description?: string;
}

export interface McpCallSuccess {
  ok: true;
  /** Verbatim result payload (JSON-serializable). */
  result: unknown;
  /** Optional human-readable summary for the trace. */
  summary?: string;
}

export interface McpCallFailure {
  ok: false;
  /** Verbatim error message — surfaced in the stop-and-report UI. */
  error: string;
  /** Tool not currently registered with the session. */
  not_registered?: boolean;
}

export type McpCallResult = McpCallSuccess | McpCallFailure;

export interface McpToolCaller {
  /** List tools currently registered with the host MCP session. */
  listAvailableTools(): Promise<McpToolDescriptor[]>;
  /** Invoke one tool and return its result. */
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
}

/**
 * Default no-op caller used when no MCP host is connected — every call
 * surfaces a "not registered" failure, which becomes a pre-flight ✗ at
 * bootstrap time per S143.
 */
export const NULL_MCP_CALLER: McpToolCaller = {
  async listAvailableTools() {
    return [];
  },
  async callTool(name: string) {
    return {
      ok: false,
      error: `MCP tool '${name}' is not available — no host MCP client is connected to setlist`,
      not_registered: true,
    };
  },
};
