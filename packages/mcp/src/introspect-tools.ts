// @fctry: #capability-declarations
import type { CapabilityDeclaration } from '@setlist/core';
import { MCP_TOOL_DEFINITIONS, type McpToolDefinition } from './server.js';

/**
 * Derive capability declarations from the MCP tool registration array.
 *
 * Contract:
 * - One declaration per tool in `MCP_TOOL_DEFINITIONS` — no bundling, no
 *   collapsing related tools into feature groups (§2.11 granularity rule).
 * - `capability_type` is the literal string `'tool'` — not `'mcp-tool'`,
 *   not pluralized, not capitalized (S112 satisfaction criterion).
 * - `description` is copied through from the tool's own description; a
 *   missing or empty description is left as-is (the introspector does not
 *   invent text, and empty descriptions surface in verification).
 * - `invocation_model: 'mcp-stdio'` and `audience: 'agent'` — these tools
 *   are invoked by agents over the MCP stdio transport.
 * - `inputs` is a JSON-stringified shape of the inputSchema's top-level
 *   properties so `query_capabilities` can filter/describe at that level
 *   without re-reading the source.
 *
 * Pure function: no side effects, no registry access. The orchestrator
 * decides when and where to write.
 */
export function introspectMcpTools(): CapabilityDeclaration[] {
  return MCP_TOOL_DEFINITIONS.map(toolToDeclaration);
}

function toolToDeclaration(tool: McpToolDefinition): CapabilityDeclaration {
  return {
    name: tool.name,
    capability_type: 'tool',
    description: tool.description ?? '',
    inputs: summarizeInputs(tool.inputSchema),
    outputs: '',
    invocation_model: 'mcp-stdio',
    audience: 'agent',
  };
}

/**
 * Compact one-line summary of a JSON Schema's top-level properties.
 * "propA: string, propB: number (required), propC: object"
 *
 * Not a full schema serialization — just enough for a human reader to see
 * the shape of inputs when browsing `query_capabilities` results.
 */
function summarizeInputs(schema: Record<string, unknown> | undefined): string {
  if (!schema || typeof schema !== 'object') return '';
  const props = schema.properties as Record<string, { type?: string | string[] }> | undefined;
  if (!props || typeof props !== 'object') return '';
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const parts: string[] = [];
  for (const [key, val] of Object.entries(props)) {
    const type = val?.type;
    const typeStr = Array.isArray(type) ? type.join('|') : (type ?? 'unknown');
    const marker = required.has(key) ? ' (required)' : '';
    parts.push(`${key}: ${typeStr}${marker}`);
  }
  return parts.join(', ');
}
