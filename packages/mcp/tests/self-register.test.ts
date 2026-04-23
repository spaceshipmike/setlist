import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, type CapabilityDeclaration } from '@setlist/core';
import { selfRegisterCapabilities, SELF_REGISTER_PROJECT, type Logger } from '../src/self-register.js';

function captureLogger(): { logger: Logger; messages: string[] } {
  const messages: string[] = [];
  return {
    logger: { warn: (m) => messages.push(m) },
    messages,
  };
}

describe('selfRegisterCapabilities (S117)', () => {
  let tmpDir: string;
  let registry: Registry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-selfreg-test-'));
    registry = new Registry(join(tmpDir, 'test.db'));
    // The orchestrator assumes the project row already exists; server startup
    // in chunk 6 handles the first-run create.
    registry.register({ name: SELF_REGISTER_PROJECT, type: 'project', status: 'active' });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Happy path ──────────────────────────────────────────────

  it('writes all three surfaces when every introspector succeeds', () => {
    const { logger, messages } = captureLogger();
    const result = selfRegisterCapabilities(registry, logger);

    expect(result.succeeded.sort()).toEqual(['cli-command', 'library', 'tool']);
    expect(result.failed).toEqual([]);
    expect(messages, 'happy path must be silent').toEqual([]);

    const all = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT });
    const byType: Record<string, number> = {};
    for (const row of all) {
      const t = row.type as string;
      byType[t] = (byType[t] ?? 0) + 1;
    }
    expect(byType.tool).toBe(39); // all 39 MCP tools
    expect(byType['cli-command']).toBeGreaterThan(0);
    expect(byType.library).toBeGreaterThan(0);
  });

  it('is idempotent — running twice leaves the row count unchanged (S113)', () => {
    const { logger } = captureLogger();
    selfRegisterCapabilities(registry, logger);
    const after1 = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT }).length;

    selfRegisterCapabilities(registry, logger);
    const after2 = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT }).length;

    expect(after2).toBe(after1);
  });

  // ── Failure isolation ──────────────────────────────────────

  it('when one introspector throws, the other two still write + exactly one warning', () => {
    // Seed a "previous good" cli-command set — it must be preserved because
    // the CLI introspector is the one we'll break.
    const prev: CapabilityDeclaration[] = [
      { name: 'old-cmd', capability_type: 'cli-command', description: 'prior good row' },
    ];
    registry.registerCapabilitiesForType(SELF_REGISTER_PROJECT, 'cli-command', prev, 'manual');

    // Break the CLI introspector by corrupting its module in-place.
    // We use vi.doMock via dynamic import cycle isn't an option; instead, we
    // simulate by monkey-patching registerCapabilitiesForType for cli-command.
    const { logger, messages } = captureLogger();

    const originalRegister = registry.registerCapabilitiesForType.bind(registry);
    const spy = vi.spyOn(registry, 'registerCapabilitiesForType').mockImplementation(
      (projectName, capabilityType, capabilities, producer) => {
        if (capabilityType === 'cli-command') {
          throw new Error('introspector blew up');
        }
        return originalRegister(projectName, capabilityType, capabilities, producer);
      },
    );

    const result = selfRegisterCapabilities(registry, logger);

    expect(result.succeeded.sort()).toEqual(['library', 'tool']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].surface).toBe('cli-command');
    expect(result.failed[0].reason).toContain('introspector blew up');

    // Exactly one warn, naming the failed surface.
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/cli-command/);
    expect(messages[0]).toMatch(/introspector blew up/);

    // Other two surfaces wrote their rows.
    const tools = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'tool' });
    expect(tools.length).toBe(39);
    const libs = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'library' });
    expect(libs.length).toBeGreaterThan(0);

    // Failing surface's prior rows are preserved (S117: last-known-good).
    const cli = registry.queryCapabilities({ project_name: SELF_REGISTER_PROJECT, capability_type: 'cli-command' });
    expect(cli).toHaveLength(1);
    expect(cli[0].name).toBe('old-cmd');

    spy.mockRestore();
  });

  it('when all three introspectors fail, emits three warnings and does not throw', () => {
    const { logger, messages } = captureLogger();

    // Break the registry write for every type.
    const spy = vi.spyOn(registry, 'registerCapabilitiesForType').mockImplementation(() => {
      throw new Error('db boom');
    });

    const result = selfRegisterCapabilities(registry, logger);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toHaveLength(3);
    expect(messages).toHaveLength(3);

    const surfaces = result.failed.map(f => f.surface).sort();
    expect(surfaces).toEqual(['cli-command', 'library', 'tool']);

    spy.mockRestore();
  });

  it('survives an introspector that returns a non-array (defensive — caller shape guard)', () => {
    const { logger, messages } = captureLogger();

    // Break by forcing registry to reject the input shape — registerCapabilitiesForType
    // validates that every declaration carries the expected capability_type.
    const spy = vi.spyOn(registry, 'registerCapabilitiesForType').mockImplementation(
      (_projectName, capabilityType) => {
        if (capabilityType === 'tool') {
          throw new Error('simulated shape validation failure');
        }
        // Others succeed via a no-op return.
        return 0;
      },
    );

    const result = selfRegisterCapabilities(registry, logger);
    expect(result.succeeded).toEqual(['cli-command', 'library']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].surface).toBe('tool');
    expect(messages).toHaveLength(1);

    spy.mockRestore();
  });
});
