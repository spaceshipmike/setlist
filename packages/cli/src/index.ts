#!/usr/bin/env node
import { Registry, initDb, scanLocations, applyProposals, scanMemories, applyMemoryMigration } from '@setlist/core';
import { runWorker, installWorker, uninstallWorker, workerStatus } from './worker.js';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

switch (command) {
  case 'init': {
    const path = initDb();
    console.log(`Registry initialized at: ${path}`);
    break;
  }

  case 'migrate': {
    const codeDir = getFlag('code-dir');
    const projectsDir = getFlag('projects-dir');
    const dryRun = hasFlag('dry-run');
    const yes = hasFlag('yes');

    const proposals = scanLocations({ codeDir, projectsDir });

    console.log(`Found ${proposals.length} project(s):\n`);

    // Group by source richness
    const bySrc: Record<string, typeof proposals> = {};
    for (const p of proposals) {
      (bySrc[p.source] ??= []).push(p);
    }

    for (const [source, group] of Object.entries(bySrc)) {
      console.log(`  ${source} (${group.length}):`);
      for (const p of group) {
        const desc = p.description ? ` — ${p.description.slice(0, 80)}` : '';
        console.log(`    ${p.display_name} (${p.name})${desc}`);
      }
      console.log();
    }

    if (dryRun) {
      console.log('Dry run — no changes applied.');
      break;
    }

    if (!yes) {
      console.log('Run with --yes to apply, or --dry-run to preview.');
      break;
    }

    const result = applyProposals(proposals);
    console.log(`\nRegistered: ${result.registered}, Skipped: ${result.skipped}, Ports claimed: ${result.ports_claimed}`);
    break;
  }

  case 'migrate-memories': {
    const apply = hasFlag('apply');
    const proposals = scanMemories();

    console.log(`Found ${proposals.length} memory file(s):\n`);
    for (const p of proposals) {
      const proj = p.project_id ?? '(global)';
      console.log(`  [${p.type}] ${proj} — ${p.content.slice(0, 80)}...`);
      console.log(`    Source: ${p.source}`);
    }

    if (!apply) {
      console.log('\nDry run — no changes applied. Use --apply to migrate.');
      break;
    }

    const result = applyMemoryMigration(proposals);
    console.log(`\nMigrated: ${result.migrated}, Skipped (dedup): ${result.skipped}`);
    break;
  }

  case 'update': {
    const name = args[1];
    if (!name || name.startsWith('--')) {
      console.error('Usage: setlist update <name> [--status <status>] [--description <desc>] [--display-name <name>] [--goals <goals>]');
      process.exit(1);
    }
    const registry = new Registry();
    registry.updateCore(name, {
      status: getFlag('status'),
      description: getFlag('description'),
      display_name: getFlag('display-name'),
      goals: getFlag('goals'),
    });
    console.log(`Project '${name}' updated.`);
    break;
  }

  case 'archive': {
    const name = args[1];
    if (!name) { console.error('Usage: setlist archive <name>'); process.exit(1); }
    const registry = new Registry();
    const result = registry.archiveProject(name);
    console.log(`Project '${name}' archived. Ports released: ${result.ports_released}, capabilities cleared: ${result.capabilities_cleared}`);
    break;
  }

  case 'worker': {
    switch (subcommand) {
      case 'run': {
        const dryRun = hasFlag('dry-run');
        const result = runWorker(undefined, dryRun);
        console.log(`Worker cycle: ${result.eligible} eligible, ${result.completed} completed, ${result.failed} failed`);
        break;
      }
      case 'install': {
        const interval = getFlag('interval') ? parseInt(getFlag('interval')!, 10) : 900;
        installWorker(interval);
        break;
      }
      case 'uninstall':
        uninstallWorker();
        break;
      case 'status':
        console.log(`Worker status: ${workerStatus()}`);
        break;
      default:
        console.log('Usage: setlist worker <run|install|uninstall|status>');
    }
    break;
  }

  default:
    console.log(`setlist — Project Registry CLI (v0.1.0)

Commands:
  init                           Initialize the registry database
  migrate [--dry-run] [--yes]    Scan ~/Code and ~/Projects, register projects
  migrate-memories [--apply]     Import CC auto-memory and fctry memory into registry
  update <name> [--status ...]   Update a project's core fields
  archive <name>                 Archive a project
  worker run [--dry-run]         Run one worker cycle
  worker install [--interval N]  Install launchd periodic job
  worker uninstall               Remove launchd job
  worker status                  Show worker status`);
}
