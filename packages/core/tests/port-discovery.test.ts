import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, discoverPortsInPath } from '../src/index.js';

describe('Port Discovery (S09)', () => {
  let tmpDir: string;
  let projectDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-pd-'));
    projectDir = join(tmpDir, 'my-project');
    require('fs').mkdirSync(projectDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers ports from vite.config.ts', () => {
    writeFileSync(join(projectDir, 'vite.config.ts'), `
      export default defineConfig({
        server: { port: 5173 }
      });
    `);

    const ports = discoverPortsInPath(projectDir);
    expect(ports.length).toBe(1);
    expect(ports[0].port).toBe(5173);
    expect(ports[0].service_label).toBe('vite dev server');
  });

  it('discovers ports from package.json --port flags', () => {
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
      scripts: { dev: 'vite --port 3001' },
    }));

    const ports = discoverPortsInPath(projectDir);
    expect(ports.length).toBe(1);
    expect(ports[0].port).toBe(3001);
  });

  it('discovers ports from docker-compose.yml', () => {
    writeFileSync(join(projectDir, 'docker-compose.yml'), `
services:
  web:
    ports:
      - "8080:80"
  db:
    ports:
      - "5432:5432"
    `);

    const ports = discoverPortsInPath(projectDir);
    expect(ports.length).toBe(2);
    expect(ports.map(p => p.port).sort()).toEqual([5432, 8080]);
  });

  it('discovers ports from .env', () => {
    writeFileSync(join(projectDir, '.env'), 'PORT=4000\nOTHER=value\n');

    const ports = discoverPortsInPath(projectDir);
    expect(ports.length).toBe(1);
    expect(ports[0].port).toBe(4000);
    expect(ports[0].service_label).toBe('env PORT');
  });

  it('deduplicates ports across files', () => {
    writeFileSync(join(projectDir, 'vite.config.ts'), 'server: { port: 3000 }');
    writeFileSync(join(projectDir, '.env'), 'PORT=3000');

    const ports = discoverPortsInPath(projectDir);
    expect(ports.length).toBe(1);
  });

  describe('Registry.discoverPorts integration', () => {
    it('claims discovered ports and skips clashes', () => {
      const dbPath = join(tmpDir, 'test.db');
      const registry = new Registry(dbPath);
      registry.register({ name: 'disc-proj', type: 'project', status: 'active', paths: [projectDir] });
      registry.register({ name: 'other-proj', type: 'project', status: 'active' });

      writeFileSync(join(projectDir, 'vite.config.ts'), 'server: { port: 3000 }');
      writeFileSync(join(projectDir, '.env'), 'PORT=3001');

      // Claim 3001 for another project
      registry.claimPort('other-proj', 'api', 3001);

      const result = registry.discoverPorts('disc-proj');
      expect(result.claimed.length).toBe(1);
      expect(result.claimed[0].port).toBe(3000);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].port).toBe(3001);
      expect(result.skipped[0].reason).toContain('other-proj');
    });

    it('is idempotent — repeated discovery does not duplicate', () => {
      const dbPath = join(tmpDir, 'test.db');
      const registry = new Registry(dbPath);
      registry.register({ name: 'idem-proj', type: 'project', status: 'active', paths: [projectDir] });

      writeFileSync(join(projectDir, 'vite.config.ts'), 'server: { port: 3000 }');

      const first = registry.discoverPorts('idem-proj');
      expect(first.claimed.length).toBe(1);

      const second = registry.discoverPorts('idem-proj');
      expect(second.claimed.length).toBe(0); // Already claimed, silently skipped
    });
  });
});
