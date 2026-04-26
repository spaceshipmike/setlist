import { describe, it, expect } from 'vitest';
import { introspectMcpTools } from '../src/introspect-tools.js';
import { MCP_TOOL_DEFINITIONS } from '../src/server.js';

describe('introspectMcpTools (S112)', () => {
  const caps = introspectMcpTools();

  it('produces exactly 56 capability declarations — one per MCP tool', () => {
    expect(caps).toHaveLength(56);
    expect(caps).toHaveLength(MCP_TOOL_DEFINITIONS.length);
  });

  it('uses the literal type string "tool" (not "mcp-tool", not "Tool")', () => {
    for (const cap of caps) {
      expect(cap.capability_type).toBe('tool');
    }
  });

  it('carries a non-empty description for every tool', () => {
    for (const cap of caps) {
      expect(cap.description).toBeTruthy();
      expect(cap.description.length).toBeGreaterThan(0);
    }
  });

  it('includes specific expected tool names across every surface of the server', () => {
    const names = new Set(caps.map(c => c.name));
    // Project identity
    expect(names.has('list_projects')).toBe(true);
    expect(names.has('register_project')).toBe(true);
    // Capabilities
    expect(names.has('register_capabilities')).toBe(true);
    expect(names.has('query_capabilities')).toBe(true);
    // Memory
    expect(names.has('retain')).toBe(true);
    expect(names.has('recall')).toBe(true);
    // Digests (v12)
    expect(names.has('get_project_digest')).toBe(true);
    expect(names.has('refresh_project_digest')).toBe(true);
    // Health
    expect(names.has('assess_health')).toBe(true);
  });

  it('names in declarations match names in MCP_TOOL_DEFINITIONS exactly', () => {
    const fromDefs = new Set(MCP_TOOL_DEFINITIONS.map(d => d.name));
    const fromCaps = new Set(caps.map(c => c.name));
    expect(fromCaps).toEqual(fromDefs);
  });

  it('annotates invocation metadata for MCP stdio agents', () => {
    for (const cap of caps) {
      expect(cap.invocation_model).toBe('mcp-stdio');
      expect(cap.audience).toBe('agent');
    }
  });

  it('summarizes inputs into a compact string (not a JSON blob)', () => {
    const getProject = caps.find(c => c.name === 'get_project');
    expect(getProject).toBeDefined();
    // get_project has `name` (required) and `detail` — we expect both to appear
    expect(getProject!.inputs).toContain('name');
    expect(getProject!.inputs).toContain('required');
    expect(getProject!.inputs).toContain('detail');
  });

  it('handles tools with empty properties (no inputs) gracefully', () => {
    const memStatus = caps.find(c => c.name === 'memory_status');
    expect(memStatus).toBeDefined();
    // memory_status takes no args — empty inputs string is fine
    expect(memStatus!.inputs).toBe('');
  });

  it('is deterministic — two calls return byte-identical results (S113)', () => {
    const a = introspectMcpTools();
    const b = introspectMcpTools();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
