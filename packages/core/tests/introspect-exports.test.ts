import { describe, it, expect } from 'vitest';
import { introspectLibraryExports, _MANIFEST_FOR_TEST } from '../src/introspect-exports.js';
import * as coreExports from '../src/index.js';

describe('introspectLibraryExports (S112)', () => {
  const caps = introspectLibraryExports();

  it('produces one declaration per manifest entry', () => {
    expect(caps).toHaveLength(_MANIFEST_FOR_TEST.length);
  });

  it('uses the literal type string "library" (not "lib", not pluralized)', () => {
    for (const cap of caps) {
      expect(cap.capability_type).toBe('library');
    }
  });

  it('carries a non-empty description for every export', () => {
    for (const cap of caps) {
      expect(cap.description).toBeTruthy();
      expect(cap.description.length).toBeGreaterThan(0);
    }
  });

  it('includes every public export listed in @setlist/core/index.ts', () => {
    // Runtime public value exports (not types — TS type-only exports are not
    // reflected in the module object at runtime)
    const runtimeExports = Object.keys(coreExports).filter(k => !k.startsWith('_'));
    const manifestNames = new Set(_MANIFEST_FOR_TEST.map(e => e.name));

    const missing = runtimeExports.filter(name => !manifestNames.has(name));
    expect(missing, `index.ts exports these at runtime but the manifest omits them: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not include anything the package does not actually export', () => {
    const runtimeExports = new Set(Object.keys(coreExports));
    const stale = _MANIFEST_FOR_TEST.filter(e => !runtimeExports.has(e.name)).map(e => e.name);
    expect(stale, `manifest lists these but they are not runtime exports of index.ts: ${stale.join(', ')}`).toEqual([]);
  });

  it('lists Registry methods in the outputs field (granularity: coarse-grained)', () => {
    const registry = caps.find(c => c.name === 'Registry');
    expect(registry).toBeDefined();
    expect(registry!.outputs).toContain('register');
    expect(registry!.outputs).toContain('getProject');
    expect(registry!.outputs).toContain('registerCapabilities');
    expect(registry!.outputs).toContain('registerCapabilitiesForType');
  });

  it('declares classes, functions, constants, and error classes distinctly via inputs kind marker', () => {
    const kindsByName = new Map(_MANIFEST_FOR_TEST.map(e => [e.name, e.kind]));
    expect(kindsByName.get('Registry')).toBe('class');
    expect(kindsByName.get('initDb')).toBe('function');
    expect(kindsByName.get('SCHEMA_VERSION')).toBe('constant');
    expect(kindsByName.get('BootstrapNotConfiguredError')).toBe('error-class');
    // And every declaration carries kind through to inputs
    const regCap = caps.find(c => c.name === 'Registry')!;
    expect(regCap.inputs).toBe('class');
  });

  it('sets invocation metadata for library import', () => {
    for (const cap of caps) {
      expect(cap.invocation_model).toBe('library-import');
      expect(cap.audience).toBe('developer');
    }
  });

  it('is deterministic — repeated calls return byte-identical results (S113)', () => {
    const a = introspectLibraryExports();
    const b = introspectLibraryExports();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
