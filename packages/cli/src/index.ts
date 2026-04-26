#!/usr/bin/env node
import {
  Registry, initDb, scanLocations, applyProposals, scanMemories, applyMemoryMigration,
  PrimitivesRegistry, Bootstrap, TRAILER_LABEL,
} from '@setlist/core';
import { runWorker, installWorker, uninstallWorker, workerStatus } from './worker.js';
import { runDigestRefresh } from './digest.js';
import { CLI_COMMAND_DEFINITIONS } from './commands.js';

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

  case 'digest': {
    if (subcommand !== 'refresh') {
      console.error('Usage: setlist digest refresh [--all | --stale | <project> [<project> …]]');
      process.exit(1);
    }
    const all = hasFlag('all');
    const stale = hasFlag('stale');
    const projectNames = args.slice(2).filter(a => !a.startsWith('--'));
    if (!all && !stale && projectNames.length === 0) {
      console.error('Usage: setlist digest refresh [--all | --stale | <project> [<project> …]]');
      process.exit(1);
    }
    if ((all || stale) && projectNames.length > 0) {
      console.error('Error: positional project names cannot be combined with --all or --stale.');
      process.exit(1);
    }
    if (all) console.log('Refreshing digests for all active projects…');
    else if (stale) console.log('Refreshing stale digests…');
    else if (projectNames.length === 1) console.log(`Refreshing digest for ${projectNames[0]}…`);
    else console.log(`Refreshing digests for ${projectNames.length} projects: ${projectNames.join(', ')}…`);

    const results = await runDigestRefresh({ projectNames, all, stale });

    const refreshed = results.filter(r => r.status === 'refreshed').length;
    const skipped = results.filter(r => r.status.startsWith('skipped')).length;
    const errored = results.filter(r => r.status === 'error').length;
    const parts = [`${refreshed} refreshed`];
    if (skipped > 0) parts.push(`${skipped} skipped`);
    parts.push(`${errored} failed`);
    console.log(`\nDone: ${parts.join(', ')} (of ${results.length} total).`);
    if (errored > 0) process.exit(1);
    break;
  }

  case 'ui': {
    // Launch or focus the Setlist desktop app
    const { execSync } = await import('node:child_process');
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const thisDir = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
    const appDir = resolve(thisDir, 'app');

    // Try to find the built .app bundle in common locations
    const candidates = [
      resolve(appDir, 'dist', 'mac-arm64', 'Setlist.app'),
      resolve(appDir, 'dist', 'mac', 'Setlist.app'),
      '/Applications/Setlist.app',
    ];

    const appPath = candidates.find(p => existsSync(p));
    if (appPath) {
      // open(1) handles single-instance: if already running, brings window to front
      execSync(`open "${appPath}"`, { stdio: 'inherit' });
    } else if (existsSync(resolve(appDir, 'package.json'))) {
      // Fall back to running electron-vite dev from the app package
      const { spawn } = await import('node:child_process');
      console.log('No built .app found. Starting development mode...');
      const child = spawn('npx', ['electron-vite', 'dev'], {
        cwd: appDir,
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
    } else {
      console.error('Setlist.app not found. Build it with: npm run build -w packages/app');
      process.exit(1);
    }
    break;
  }

  case 'primitives': {
    const pr = new PrimitivesRegistry();
    switch (subcommand) {
      case 'list': {
        const all = pr.listPrimitives();
        for (const p of all) {
          const tag = p.is_builtin ? 'builtin' : 'custom ';
          console.log(`  [${p.id}] ${tag} ${p.shape.padEnd(15)} ${p.name}`);
          if (p.description) console.log(`        ${p.description}`);
        }
        if (all.length === 0) console.log('  (no primitives — run setlist init to seed built-ins)');
        break;
      }
      case 'show': {
        const idStr = getFlag('id');
        if (!idStr) { console.error('Usage: setlist primitives show --id <n>'); process.exit(1); }
        const p = pr.getPrimitive(parseInt(idStr, 10));
        if (!p) { console.error(`No primitive with id ${idStr}`); process.exit(1); }
        console.log(`Name:        ${p.name}`);
        console.log(`Shape:       ${p.shape}`);
        console.log(`Built-in:    ${p.is_builtin ? `yes (${p.builtin_key})` : 'no'}`);
        console.log(`Description: ${p.description || '(none)'}`);
        console.log(`Definition:`);
        console.log('  ' + JSON.stringify(p.definition, null, 2).split('\n').join('\n  '));
        const refs = pr.countReferences(p.id);
        if (refs > 0) {
          const types = pr.listReferencingTypes(p.id);
          console.log(`Referenced by ${refs} recipe step(s) in: ${types.join(', ')}`);
        }
        break;
      }
      case 'delete': {
        const idStr = getFlag('id');
        if (!idStr) { console.error('Usage: setlist primitives delete --id <n>'); process.exit(1); }
        try {
          pr.deletePrimitive(parseInt(idStr, 10));
          console.log(`Primitive ${idStr} deleted.`);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
        break;
      }
      default:
        console.log('Usage: setlist primitives <list|show|delete> [--id <n>]');
    }
    break;
  }

  case 'recipe': {
    const pr = new PrimitivesRegistry();
    const reg = new Registry();
    switch (subcommand) {
      case 'list': {
        const types = reg.listProjectTypes();
        for (const t of types) {
          const recipe = pr.getRecipe(t.id);
          console.log(`  [${t.id}] ${t.name.padEnd(25)} ${recipe.steps.length} step(s) + 1 trailer`);
        }
        if (types.length === 0) console.log('  (no project types — run setlist init to seed defaults)');
        break;
      }
      case 'show': {
        const typeStr = getFlag('type');
        if (!typeStr) { console.error('Usage: setlist recipe show --type <project_type_id>'); process.exit(1); }
        const typeId = parseInt(typeStr, 10);
        const types = reg.listProjectTypes();
        const t = types.find(t => t.id === typeId);
        if (!t) { console.error(`No project type with id ${typeId}`); process.exit(1); }
        const recipe = pr.getRecipe(typeId);
        console.log(`${t.name} (id ${t.id}) — ${recipe.steps.length} user-droppable step(s)`);
        console.log();
        for (const step of recipe.steps) {
          const params = Object.entries(step.params).map(([k, v]) => `${k}=${v}`).join(', ');
          console.log(`  ${String(step.position + 1).padStart(2)}. ${step.primitive.shape.padEnd(15)} ${step.primitive.name}`);
          if (params) console.log(`      ${params}`);
        }
        console.log(`  ${String(recipe.steps.length + 1).padStart(2)}. ${'(structural)'.padEnd(15)} ${TRAILER_LABEL}`);
        break;
      }
      default:
        console.log('Usage: setlist recipe <list|show> [--type <id>]');
    }
    break;
  }

  case 'bootstrap': {
    const name = args[1];
    if (!name || name.startsWith('--')) {
      console.error('Usage: setlist bootstrap <name> --type <project_type_id> [--dry-run] [--area <name>] [--parent <name>] [--description <d>]');
      process.exit(1);
    }
    const typeStr = getFlag('type');
    if (!typeStr) {
      console.error('Required: --type <project_type_id> (use `setlist recipe list` to see available types)');
      process.exit(1);
    }
    const dryRun = hasFlag('dry-run');
    const bs = new Bootstrap();
    const env = await bs.bootstrapWithRecipe({
      name,
      project_type_id: parseInt(typeStr, 10),
      dry_run: dryRun,
      area: getFlag('area'),
      parent_project: getFlag('parent'),
      description: getFlag('description'),
    });
    if (env.kind === 'dry-run') {
      console.log(`Dry run for '${name}' at ${env.path}\n`);
      for (const s of env.steps) {
        const marker = s.preflight_ok ? '✓' : `✗ — ${s.preflight_reason ?? 'failed'}`;
        const params = Object.entries(s.resolved_params).map(([k, v]) => `${k}=${v}`).join(', ');
        console.log(`  ${String(s.position + 1).padStart(2)}. ${s.shape.padEnd(15)} ${s.primitive_name} [${marker}]`);
        if (params) console.log(`      ${params}`);
      }
      console.log('\nNo side effects — nothing was created.');
    } else if (env.kind === 'success') {
      console.log(`Bootstrapped '${env.name}' at ${env.path}`);
      console.log(`  git_initialized: ${env.git_initialized}, templates_applied: ${env.templates_applied}, parent_gitignore_updated: ${env.parent_gitignore_updated}`);
      console.log(`  ${env.executed_steps?.length ?? 0} step(s) ran`);
    } else if (env.kind === 'pre-flight-failed') {
      console.error(`Bootstrap pre-flight failed for '${env.name}':`);
      for (const f of env.preflight_failures) {
        console.error(`  Step ${f.position + 1}: ${f.primitive_name} — ${f.reason}`);
      }
      process.exit(1);
    } else if (env.kind === 'pending') {
      console.error(`Bootstrap halted at step ${env.failed_at + 1}: ${env.error_output}`);
      console.error(`Use the desktop app or the MCP bootstrap_resolve tool with token to retry/skip/abandon.`);
      process.exit(2);
    }
    break;
  }

  default: {
    // Help text is derived from CLI_COMMAND_DEFINITIONS so the runtime
    // dispatcher and the startup introspector stay in sync.
    const lines: string[] = ['setlist — Project Registry CLI (v0.1.0)', '', 'Commands:'];
    for (const cmd of CLI_COMMAND_DEFINITIONS) {
      lines.push(`  ${cmd.usage.padEnd(62)} ${cmd.description}`);
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          const usage = sub.usage ?? `setlist ${cmd.name} ${sub.name}`;
          lines.push(`    ${usage.padEnd(60)} ${sub.description}`);
        }
      }
    }
    console.log(lines.join('\n'));
  }
}
