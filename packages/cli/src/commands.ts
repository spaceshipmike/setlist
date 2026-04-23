// @fctry: #capability-declarations
/**
 * The authoritative list of top-level CLI commands.
 *
 * Both the runtime dispatcher in `index.ts` and the startup-time introspector
 * (`introspect-commands.ts`) read from this array — single source of truth, no
 * drift possible between what the CLI actually runs and what the registry
 * says it can run.
 *
 * A command is one top-level `setlist <name>` subcommand. Nested subcommands
 * (e.g. `setlist worker run`) are documented in `subcommands` of their parent,
 * not registered as separate capability rows (§2.11 granularity: one callable
 * thing per capability, and the callable thing is the top-level command).
 */
export interface CliCommandDefinition {
  /** Top-level command name — e.g. "init", "migrate", "digest", "worker". */
  name: string;
  /** One-sentence human description. */
  description: string;
  /** Usage string shown in help output — e.g. "setlist migrate [--dry-run] [--yes]". */
  usage: string;
  /** Nested subcommand documentation, if any. */
  subcommands?: Array<{ name: string; description: string; usage?: string }>;
}

export const CLI_COMMAND_DEFINITIONS: CliCommandDefinition[] = [
  {
    name: 'init',
    description: 'Initialize the registry database at the default location.',
    usage: 'setlist init',
  },
  {
    name: 'migrate',
    description: 'Scan ~/Code and ~/Projects and register discovered projects into the registry.',
    usage: 'setlist migrate [--code-dir <path>] [--projects-dir <path>] [--dry-run] [--yes]',
  },
  {
    name: 'migrate-memories',
    description: 'Import Claude Code auto-memory and fctry memory files into the unified memory store.',
    usage: 'setlist migrate-memories [--apply]',
  },
  {
    name: 'update',
    description: 'Update a project\'s core identity fields (status, description, display_name, goals).',
    usage: 'setlist update <name> [--status <s>] [--description <d>] [--display-name <n>] [--goals <g>]',
  },
  {
    name: 'archive',
    description: 'Archive a project: release its claimed ports, clear capability rows, mark archived.',
    usage: 'setlist archive <name>',
  },
  {
    name: 'worker',
    description: 'Manage the async worker (runs queued tasks on a schedule via launchd).',
    usage: 'setlist worker <run|install|uninstall|status>',
    subcommands: [
      { name: 'run', description: 'Run a single worker cycle immediately.', usage: 'setlist worker run [--dry-run]' },
      { name: 'install', description: 'Install the launchd periodic job.', usage: 'setlist worker install [--interval <seconds>]' },
      { name: 'uninstall', description: 'Remove the launchd job.', usage: 'setlist worker uninstall' },
      { name: 'status', description: 'Report whether the worker is installed.', usage: 'setlist worker status' },
    ],
  },
  {
    name: 'digest',
    description: 'Generate and store per-project essence digests (free-form summaries, versioned by spec version).',
    usage: 'setlist digest refresh [--all | --stale | <project> [<project> …]]',
    subcommands: [
      { name: 'refresh', description: 'Regenerate one or more project digests.', usage: 'setlist digest refresh [--all | --stale | <project> …]' },
    ],
  },
  {
    name: 'ui',
    description: 'Launch or focus the Setlist desktop app (the control panel).',
    usage: 'setlist ui',
  },
];
