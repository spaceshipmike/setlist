import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer, SETLIST_CANONICAL_DESCRIPTION, SETLIST_CANONICAL_AREA, MCP_TOOL_DEFINITIONS } from '../src/server.js';
import { SELF_REGISTER_PROJECT, type Logger } from '../src/self-register.js';
import { Registry } from '@setlist/core';

// Replicates the server-test helper; duplicated to keep the file standalone.
function callTool(server: ReturnType<typeof createServer>, name: string, args: Record<string, unknown> = {}): unknown {
  const handler = (server as any)._requestHandlers.get('tools/call');
  const p = handler({ method: 'tools/call', params: { name, arguments: args } }, {});
  return p.then((response: { content: { text: string }[] }) => {
    const text = response.content[0].text;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  });
}

function captureLogger(): { logger: Logger; messages: string[] } {
  const messages: string[] = [];
  return { logger: { warn: (m: string) => messages.push(m) }, messages };
}

describe('MCP server startup self-registration (goal gate — S112, S113, S114, S115, S116, S117)', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-selfreg-int-'));
    dbPath = join(tmpDir, 'test.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── S115: Fresh DB → project row auto-created before caps land ──

  it('S115: fresh DB — boot creates the setlist project row automatically before writing capabilities', async () => {
    const { logger, messages } = captureLogger();
    const server = createServer(dbPath, { logger });

    const proj = await callTool(server, 'get_project', { name: SELF_REGISTER_PROJECT }) as Record<string, unknown>;
    expect(proj.name).toBe(SELF_REGISTER_PROJECT);
    expect(proj.description).toBe(SETLIST_CANONICAL_DESCRIPTION);
    // Area is returned as a structured object in depth=full; check the canonical name appears.
    const areaField = JSON.stringify(proj.area ?? '');
    expect(areaField).toContain(SETLIST_CANONICAL_AREA);

    // Capability rows landed after the project row.
    const caps = await callTool(server, 'query_capabilities', { project_name: SELF_REGISTER_PROJECT }) as Array<Record<string, unknown>>;
    expect(caps.length).toBeGreaterThan(0);

    // Happy path is silent.
    expect(messages, 'happy path must not log warnings').toEqual([]);
  });

  // ── S112: Each type filter returns the expected set by surface ──

  it('S112: query_capabilities returns exactly 56 tool rows, all CLI commands, and all library exports', async () => {
    const server = createServer(dbPath);

    const tools = await callTool(server, 'query_capabilities', { project_name: SELF_REGISTER_PROJECT, type: 'tool' }) as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(56);
    expect(tools.every(r => r.type === 'tool')).toBe(true);

    const cmds = await callTool(server, 'query_capabilities', { project_name: SELF_REGISTER_PROJECT, type: 'cli-command' }) as Array<Record<string, unknown>>;
    expect(cmds.length).toBeGreaterThanOrEqual(8); // at minimum: init, migrate, migrate-memories, update, archive, worker, digest, ui
    expect(cmds.every(r => r.type === 'cli-command')).toBe(true);

    const libs = await callTool(server, 'query_capabilities', { project_name: SELF_REGISTER_PROJECT, type: 'library' }) as Array<Record<string, unknown>>;
    expect(libs.length).toBeGreaterThan(0);
    expect(libs.every(r => r.type === 'library')).toBe(true);

    // Every row carries a non-empty description (S112 criterion).
    for (const row of [...tools, ...cmds, ...libs]) {
      expect(row.description, `row ${JSON.stringify(row)}`).toBeTruthy();
      expect((row.description as string).length).toBeGreaterThan(0);
    }

    // Type strings are literal (not 'mcp-tool', not 'cli', not pluralized).
    const types = new Set([...tools, ...cmds, ...libs].map(r => r.type));
    expect(types).toEqual(new Set(['tool', 'cli-command', 'library']));
  });

  // ── S113: Restart → identical capability set ────────────────────

  it('S113: restart against the same DB produces an identical capability set (idempotence)', async () => {
    const server1 = createServer(dbPath);
    const before = await callTool(server1, 'query_capabilities', { project_name: SELF_REGISTER_PROJECT }) as Array<Record<string, unknown>>;
    const beforeSorted = before.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));

    // Simulated restart.
    const server2 = createServer(dbPath);
    const after = await callTool(server2, 'query_capabilities', { project_name: SELF_REGISTER_PROJECT }) as Array<Record<string, unknown>>;
    const afterSorted = after.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));

    expect(afterSorted.length).toBe(beforeSorted.length);
    for (let i = 0; i < beforeSorted.length; i++) {
      expect(afterSorted[i].name).toBe(beforeSorted[i].name);
      expect(afterSorted[i].type).toBe(beforeSorted[i].type);
      expect(afterSorted[i].description).toBe(beforeSorted[i].description);
    }

    // Ten-restart loop — row count holds steady.
    for (let i = 0; i < 8; i++) {
      createServer(dbPath);
    }
    const after10 = await callTool(createServer(dbPath), 'query_capabilities', { project_name: SELF_REGISTER_PROJECT }) as Array<Record<string, unknown>>;
    expect(after10.length).toBe(beforeSorted.length);
  });

  // ── S115 (idempotence at project-row level) ────────────────────

  it('S115: second startup does NOT duplicate the setlist project row', async () => {
    createServer(dbPath);
    createServer(dbPath);
    createServer(dbPath);

    // Count setlist rows via the registry directly.
    const registry = new Registry(dbPath);
    const server4 = createServer(dbPath);
    const all = await callTool(server4, 'list_projects', { detail: 'minimal' }) as Array<{ name: string }>;
    const setlistRows = all.filter(r => r.name === SELF_REGISTER_PROJECT);
    expect(setlistRows).toHaveLength(1);
    // keep registry reference alive so TS doesn't strip it
    expect(registry).toBeDefined();
  });

  // ── S115 safety-net behavior: pre-registered setlist row is not overwritten ──

  it('S115: when operator has pre-registered setlist, its description is preserved', async () => {
    const registry = new Registry(dbPath);
    registry.register({
      name: SELF_REGISTER_PROJECT,
      type: 'project',
      status: 'active',
      description: 'Operator-chosen description — should survive self-registration.',
      area: 'Work', // intentionally a different area than canonical
    });

    createServer(dbPath); // triggers self-register
    const proj = registry.getProject(SELF_REGISTER_PROJECT, 'full');
    expect(proj!.description).toBe('Operator-chosen description — should survive self-registration.');
    // Area stays as operator chose; we don't overwrite.
    const areaField = JSON.stringify(proj!.area ?? '');
    expect(areaField).toContain('Work');
    expect(areaField).not.toContain('Infrastructure');

    // Capabilities still got registered.
    const caps = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT });
    expect(caps.length).toBeGreaterThan(0);
  });

  // ── S114: Code change → next boot reflects it ──────────────────

  it('S114: a code change to the tool surface appears on the next boot', async () => {
    // First boot under the "original" code.
    createServer(dbPath);
    const registry = new Registry(dbPath);
    const before = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'tool' });
    const beforeCount = before.length;
    expect(beforeCount).toBe(56);

    // Simulate a code change: temporarily splice an extra tool into MCP_TOOL_DEFINITIONS,
    // remove an existing one, then re-create the server.
    const fakeTool = {
      name: '__fake_debug_tool',
      description: 'Injected by S114 test — verifies code-reality reflection.',
      inputSchema: { type: 'object' as const, properties: {} },
    };
    const originalList = [...MCP_TOOL_DEFINITIONS];
    const removedIdx = MCP_TOOL_DEFINITIONS.findIndex(t => t.name === 'memory_status');
    const removedTool = MCP_TOOL_DEFINITIONS[removedIdx];
    expect(removedTool).toBeDefined();
    MCP_TOOL_DEFINITIONS.splice(removedIdx, 1); // remove memory_status
    MCP_TOOL_DEFINITIONS.push(fakeTool); // add fake tool

    try {
      createServer(dbPath);
      const after = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'tool' });
      expect(after.length).toBe(beforeCount); // -1 removed, +1 added = same count
      const names = new Set(after.map(r => r.name));
      expect(names.has('__fake_debug_tool')).toBe(true);
      expect(names.has('memory_status')).toBe(false); // removed tool is gone, not a tombstone
    } finally {
      // Restore original list for subsequent tests.
      MCP_TOOL_DEFINITIONS.length = 0;
      MCP_TOOL_DEFINITIONS.push(...originalList);
    }

    // After "fixing" the code (restoring the list), the next boot heals the gap.
    createServer(dbPath);
    const healed = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'tool' });
    expect(healed.length).toBe(56);
    const healedNames = new Set(healed.map(r => r.name));
    expect(healedNames.has('memory_status')).toBe(true);
    expect(healedNames.has('__fake_debug_tool')).toBe(false);
  });

  // ── S116: Cross-surface discovery without project filter ───────

  it('S116: type-filtered queries return the union across projects for that type', async () => {
    createServer(dbPath);
    const registry = new Registry(dbPath);

    // Add another project with a mix of types.
    registry.register({ name: 'chorus-app', type: 'project', status: 'active' });
    registry.registerCapabilities('chorus-app', [
      { name: 'chorus_tool', capability_type: 'tool', description: 'Chorus tool' },
      { name: 'chorus_cmd', capability_type: 'cli-command', description: 'Chorus CLI' },
      { name: 'ChorusLib', capability_type: 'library', description: 'Chorus library' },
    ]);

    const allTools = registry.queryCapabilities({ capability_type: 'tool' });
    // setlist 56 + chorus 1 = 57 (spec 0.28: +9 primitives/recipes/bootstrap_resolve)
    expect(allTools.length).toBe(57);
    expect(allTools.some(r => r.project === SELF_REGISTER_PROJECT && r.name === 'list_projects')).toBe(true);
    expect(allTools.some(r => r.project === 'chorus-app' && r.name === 'chorus_tool')).toBe(true);

    const cmds = registry.queryCapabilities({ capability_type: 'cli-command' });
    expect(cmds.some(r => r.project === 'chorus-app' && r.name === 'chorus_cmd')).toBe(true);
    expect(cmds.some(r => r.project === SELF_REGISTER_PROJECT)).toBe(true);

    const libs = registry.queryCapabilities({ capability_type: 'library' });
    expect(libs.some(r => r.project === 'chorus-app' && r.name === 'ChorusLib')).toBe(true);
    expect(libs.some(r => r.project === SELF_REGISTER_PROJECT)).toBe(true);

    // Unknown type returns empty, not an error.
    const apiEndpoints = registry.queryCapabilities({ capability_type: 'api-endpoint' });
    expect(apiEndpoints).toEqual([]);

    // Combined filter ANDs.
    const setlistCmds = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'cli-command' });
    expect(setlistCmds.every(r => r.project === SELF_REGISTER_PROJECT)).toBe(true);

    // Keyword crosses surfaces.
    const digestMatches = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, keyword: 'digest' });
    const matchedTypes = new Set(digestMatches.map(r => r.type));
    // "digest" hits both a tool (refresh_project_digest) and a CLI command (digest).
    expect(matchedTypes.has('tool')).toBe(true);
    expect(matchedTypes.has('cli-command')).toBe(true);
  });

  // ── S117: One introspector fails → others land + warning + server responsive ──

  it('S117: when one introspector throws at startup, the other two write + exactly one warning + server responsive', async () => {
    // Seed prior-good cli-command rows so we can verify they survive.
    const registry = new Registry(dbPath);
    registry.register({
      name: SELF_REGISTER_PROJECT,
      type: 'project',
      status: 'active',
      description: SETLIST_CANONICAL_DESCRIPTION,
      area: SETLIST_CANONICAL_AREA,
    });
    registry.registerCapabilitiesForType(SELF_REGISTER_PROJECT, 'cli-command', [
      { name: 'prior_cmd', capability_type: 'cli-command', description: 'Prior good row' },
    ], 'manual');

    // Break registerCapabilitiesForType('cli-command') so the cli introspector's
    // write path throws. (Spying on the prototype affects the Registry instance
    // that createServer will instantiate too, since it's the same class.)
    const spy = vi.spyOn(Registry.prototype, 'registerCapabilitiesForType').mockImplementation(
      function (this: Registry, projectName: string, capabilityType: string, capabilities, producer) {
        if (capabilityType === 'cli-command') {
          throw new Error('simulated cli-command write failure');
        }
        // Call through to the original for other types.
        return Registry.prototype.registerCapabilitiesForType.wrappedMethod!.call(
          this, projectName, capabilityType, capabilities, producer,
        );
      },
    );
    // vitest's spyOn does expose .wrappedMethod only for mockImplementation patterns;
    // fall back to using the original via the untyped import.
    // Instead: cleaner approach — construct a fresh Registry inside the mock impl.
    spy.mockRestore();

    // Cleaner approach: run the real createServer once to populate setlist + capabilities,
    // then spy more narrowly to induce only a cli-command failure on a SECOND boot.
    createServer(dbPath);
    const firstRun = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'cli-command' });
    expect(firstRun.length).toBeGreaterThan(0); // prior_cmd was replaced by introspected CLI command set

    // For the induced failure, patch via a bound reference on the instance the server will create.
    const spy2 = vi.spyOn(Registry.prototype, 'registerCapabilitiesForType');
    const originalImpl = spy2.getMockImplementation();
    // spy2.getMockImplementation() is undefined at this point (we haven't set one);
    // we must call the original. Obtain it via the Registry.prototype method from
    // the module — but the spy has already replaced it. Use spy2.mockRestore() with
    // a guarded replacement.
    spy2.mockRestore();

    // Record the real method from the prototype before we spy again.
    const realMethod = Registry.prototype.registerCapabilitiesForType;
    const spy3 = vi.spyOn(Registry.prototype, 'registerCapabilitiesForType').mockImplementation(
      function (this: Registry, projectName: string, capabilityType: string, capabilities: any, producer?: string) {
        if (capabilityType === 'cli-command') {
          throw new Error('simulated cli-command write failure');
        }
        return realMethod.call(this, projectName, capabilityType, capabilities, producer);
      },
    );

    // Seed a fresh prior-good cli-command so we can observe preservation.
    realMethod.call(registry, SELF_REGISTER_PROJECT, 'cli-command', [
      { name: 'prior_cmd_2', capability_type: 'cli-command', description: 'Second prior good row' },
    ], 'manual');

    const { logger, messages } = captureLogger();
    const server = createServer(dbPath, { logger });

    // Exactly one warning, naming cli-command.
    const cliWarn = messages.filter(m => m.includes('cli-command'));
    expect(cliWarn).toHaveLength(1);
    expect(cliWarn[0]).toMatch(/simulated cli-command write failure/);

    // Other two surfaces landed.
    const tools = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'tool' });
    expect(tools.length).toBe(56);

    // The failing surface's prior-good rows are preserved.
    const cli = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'cli-command' });
    expect(cli.some(r => r.name === 'prior_cmd_2')).toBe(true);

    // Server is responsive to a tool call.
    const stats = await callTool(server, 'get_registry_stats') as Record<string, unknown>;
    expect(stats).toBeDefined();
    expect(stats.total).toBeDefined();

    spy3.mockRestore();

    // On a subsequent clean boot, the cli surface heals.
    const clean = createServer(dbPath);
    const healed = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'cli-command' });
    expect(healed.length).toBeGreaterThan(0);
    expect(healed.every(r => r.name !== 'prior_cmd_2')).toBe(true); // replaced with introspected set
    expect(clean).toBeDefined();
  });
});
