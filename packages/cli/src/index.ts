#!/usr/bin/env node
import { Registry, MemoryStore, initDb } from '@setlist/core';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init': {
    const path = initDb();
    console.log(`Registry initialized at: ${path}`);
    break;
  }
  case 'update': {
    const name = args[1];
    if (!name) { console.error('Usage: setlist update <name> [--status <status>] [--description <desc>]'); process.exit(1); }
    const registry = new Registry();
    const updates: Record<string, string> = {};
    for (let i = 2; i < args.length; i += 2) {
      const flag = args[i].replace(/^--/, '');
      updates[flag] = args[i + 1];
    }
    registry.updateCore(name, updates);
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
  default:
    console.log(`setlist - Project Registry CLI

Commands:
  init                     Initialize the registry database
  update <name> [--field value]  Update a project's core fields
  archive <name>           Archive a project

More commands coming soon: migrate, migrate-memories, worker`);
}
