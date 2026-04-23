import { describe, it, expect } from 'vitest';
import { introspectCliCommands } from '../src/introspect-commands.js';
import { CLI_COMMAND_DEFINITIONS } from '../src/commands.js';

describe('introspectCliCommands (S112)', () => {
  const caps = introspectCliCommands();

  it('produces one declaration per top-level command — no drift from the dispatcher list', () => {
    expect(caps).toHaveLength(CLI_COMMAND_DEFINITIONS.length);
    const declNames = caps.map(c => c.name).sort();
    const defNames = CLI_COMMAND_DEFINITIONS.map(d => d.name).sort();
    expect(declNames).toEqual(defNames);
  });

  it('uses the literal type string "cli-command" (not "cli", not pluralized)', () => {
    for (const cap of caps) {
      expect(cap.capability_type).toBe('cli-command');
    }
  });

  it('carries a non-empty description for every command', () => {
    for (const cap of caps) {
      expect(cap.description).toBeTruthy();
      expect(cap.description.length).toBeGreaterThan(0);
    }
  });

  it('includes the expected commands the dispatcher actually handles', () => {
    const names = new Set(caps.map(c => c.name));
    // The switch in index.ts dispatches on these exact cases:
    expect(names.has('init')).toBe(true);
    expect(names.has('migrate')).toBe(true);
    expect(names.has('migrate-memories')).toBe(true);
    expect(names.has('update')).toBe(true);
    expect(names.has('archive')).toBe(true);
    expect(names.has('worker')).toBe(true);
    expect(names.has('digest')).toBe(true);
    expect(names.has('ui')).toBe(true);
  });

  it('does NOT register nested subcommands as separate capabilities', () => {
    // "worker run", "worker install", "worker uninstall", "worker status"
    // should all roll up into a single `worker` declaration (granularity
    // principle from §2.11: one callable thing per capability row).
    const names = new Set(caps.map(c => c.name));
    expect(names.has('worker run')).toBe(false);
    expect(names.has('worker install')).toBe(false);
    expect(names.has('digest refresh')).toBe(false);
    // The subcommand documentation must live somewhere the agent can find it.
    const worker = caps.find(c => c.name === 'worker');
    expect(worker!.outputs).toContain('run');
    expect(worker!.outputs).toContain('install');
    expect(worker!.outputs).toContain('uninstall');
    expect(worker!.outputs).toContain('status');

    const digest = caps.find(c => c.name === 'digest');
    expect(digest!.outputs).toContain('refresh');
  });

  it('sets invocation metadata for developer CLI use', () => {
    for (const cap of caps) {
      expect(cap.invocation_model).toBe('cli');
      expect(cap.audience).toBe('developer');
    }
  });

  it('carries the usage string in inputs so agents can see the flag shape', () => {
    const migrate = caps.find(c => c.name === 'migrate');
    expect(migrate).toBeDefined();
    expect(migrate!.inputs).toContain('setlist migrate');
    expect(migrate!.inputs).toContain('--dry-run');
  });

  it('is deterministic — repeated calls return byte-identical results (S113)', () => {
    const a = introspectCliCommands();
    const b = introspectCliCommands();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
