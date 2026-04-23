// @fctry: #capability-declarations
import type { CapabilityDeclaration } from '@setlist/core';
import { CLI_COMMAND_DEFINITIONS, type CliCommandDefinition } from './commands.js';

/**
 * Derive CapabilityDeclarations from the CLI command list.
 *
 * Contract:
 * - One declaration per top-level command — nested subcommands are documented
 *   in the `outputs` field of the parent capability, not broken out into
 *   separate rows (§2.11 granularity: the callable thing is the top-level
 *   command; subcommands are routing within it).
 * - `capability_type: 'cli-command'` verbatim (S112 satisfaction criterion).
 * - `invocation_model: 'cli'`, `audience: 'developer'` — these are invoked by
 *   humans or scripts at a shell prompt.
 * - `inputs` carries the usage string so agents browsing capabilities can see
 *   the expected flag/arg shape without reading the CLI source.
 * - `outputs` carries a formatted subcommand summary when present.
 *
 * Pure function: no process.argv access, no side effects.
 */
export function introspectCliCommands(): CapabilityDeclaration[] {
  return CLI_COMMAND_DEFINITIONS.map(commandToDeclaration);
}

function commandToDeclaration(cmd: CliCommandDefinition): CapabilityDeclaration {
  return {
    name: cmd.name,
    capability_type: 'cli-command',
    description: cmd.description,
    inputs: cmd.usage,
    outputs: formatSubcommands(cmd.subcommands),
    invocation_model: 'cli',
    audience: 'developer',
  };
}

function formatSubcommands(subs: CliCommandDefinition['subcommands']): string {
  if (!subs || subs.length === 0) return '';
  return subs.map(s => `${s.name}: ${s.description}`).join('; ');
}
