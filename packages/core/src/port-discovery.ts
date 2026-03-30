import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface DiscoveredPort {
  port: number;
  service_label: string;
  source_file: string;
}

const PORT_CONFIG_FILES = [
  'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs',
  'package.json',
  'docker-compose.yml', 'docker-compose.yaml',
  '.env', '.env.local', '.env.development',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'angular.json',
  'webpack.config.js',
  'nuxt.config.ts', 'nuxt.config.js',
];

export function discoverPortsInPath(projectPath: string): DiscoveredPort[] {
  const discovered: DiscoveredPort[] = [];
  const seen = new Set<number>();

  for (const file of PORT_CONFIG_FILES) {
    const fullPath = join(projectPath, file);
    if (!existsSync(fullPath)) continue;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const ports = extractPorts(content, file);

      for (const p of ports) {
        if (!seen.has(p.port)) {
          seen.add(p.port);
          discovered.push({ ...p, source_file: file });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return discovered;
}

function extractPorts(content: string, filename: string): { port: number; service_label: string }[] {
  const base = basename(filename);
  const results: { port: number; service_label: string }[] = [];

  if (base.startsWith('vite.config')) {
    // port: 3000 or port: 5173
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'vite dev server' });
    }
  } else if (base === 'package.json') {
    // --port 3000 or --port=3000 in scripts
    const matches = content.matchAll(/--port[= ](\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'dev script' });
    }
  } else if (base.startsWith('docker-compose')) {
    // "3000:3000" or ports: ["3000:80"]
    const matches = content.matchAll(/["']?(\d+):\d+["']?/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'docker-compose' });
    }
  } else if (base.startsWith('.env')) {
    // PORT=3000
    const matches = content.matchAll(/^PORT\s*=\s*(\d+)/gm);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'env PORT' });
    }
  } else if (base.startsWith('next.config')) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'next dev server' });
    }
  } else if (base === 'angular.json') {
    const matches = content.matchAll(/"port"\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'angular dev server' });
    }
  } else if (base.startsWith('webpack.config')) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'webpack dev server' });
    }
  } else if (base.startsWith('nuxt.config')) {
    const matches = content.matchAll(/port\s*:\s*(\d+)/g);
    for (const m of matches) {
      results.push({ port: parseInt(m[1], 10), service_label: 'nuxt dev server' });
    }
  }

  // Filter to valid port range
  return results.filter(p => p.port >= 1 && p.port <= 65535);
}
