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
  {
    name: 'primitives',
    description: 'List, inspect, or manage bootstrap primitives (built-in and user-authored).',
    usage: 'setlist primitives <list|show|delete> [--id <n>]',
    subcommands: [
      { name: 'list', description: 'List every bootstrap primitive (built-ins first, then custom).', usage: 'setlist primitives list' },
      { name: 'show', description: 'Show one primitive\'s name, shape, description, and parsed definition.', usage: 'setlist primitives show --id <n>' },
      { name: 'delete', description: 'Delete a custom primitive (built-ins and referenced primitives are blocked).', usage: 'setlist primitives delete --id <n>' },
    ],
  },
  {
    name: 'recipe',
    description: 'List or inspect per-type bootstrap recipes.',
    usage: 'setlist recipe <list|show> [--type <id>]',
    subcommands: [
      { name: 'list', description: 'List recipes for every project type with step counts.', usage: 'setlist recipe list' },
      { name: 'show', description: 'Show the ordered steps + the structural register-in-registry trailer for one project type.', usage: 'setlist recipe show --type <id>' },
    ],
  },
  {
    name: 'bootstrap',
    description: 'Bootstrap a new project end-to-end (or dry-run the recipe to see what would happen).',
    usage: 'setlist bootstrap <name> --type <project_type_id> [--dry-run] [--area <name>] [--parent <name>]',
  },
];
