// @fctry: #capability-declarations
import type { CapabilityDeclaration } from './models.js';

/**
 * Library-export introspection for the `@setlist/core` public API.
 *
 * Rather than walking the module graph at runtime (fragile, ESM-unfriendly,
 * and would require deep reflection into the transpiled output), we keep a
 * hand-maintained manifest of the package's public surface right next to
 * the `index.ts` that re-exports it. The two MUST stay in sync — tests in
 * `introspect-exports.test.ts` assert parity between this manifest and
 * what `index.ts` actually exports at runtime.
 *
 * Granularity (S112 / §2.11):
 * - Each public class gets one declaration with its public methods in the
 *   `outputs` field. An agent discovering "setlist library capabilities"
 *   sees `Registry` as one capability whose methods are documented inline,
 *   not as 40 separate rows that would drown out the structural picture.
 * - Each top-level function (initDb, scanLocations, …) is its own declaration.
 * - Constants (SCHEMA_VERSION, PORT_RANGE_MIN, …) are declared with
 *   capability_type 'library' and outputs describing the value.
 * - Error classes (BootstrapNotConfiguredError, …) are declared so agents
 *   catching them know what the package may throw.
 */

interface LibraryExportManifestEntry {
  name: string;
  kind: 'class' | 'function' | 'constant' | 'error-class';
  description: string;
  /** Comma-separated method names or extra notes, surfaced in `outputs`. */
  detail?: string;
}

const LIBRARY_EXPORTS_MANIFEST: LibraryExportManifestEntry[] = [
  // Classes
  {
    name: 'Registry',
    kind: 'class',
    description: 'Primary database-backed API over the project registry: identity, ports, capabilities, digests, task queue, batch updates, and archive lifecycle.',
    detail: 'register, getProject, getProjectOrThrow, listProjects, searchProjects, getRegistryStats, switchProject, updateCore, setProjectArea, setParentProject, archiveProject, renameProject, enrichProject, updateFields, batchUpdate, claimPort, releasePort, checkPort, listProjectPorts, discoverPorts, registerCapabilities, registerCapabilitiesForType, queryCapabilities, getProjectDigest, getProjectDigests, refreshProjectDigest, queueTask, listTasks',
  },
  {
    name: 'MemoryStore',
    kind: 'class',
    description: 'Write-side of the unified memory store: retain, forget, correct, supersede, entity linking, temporal validity.',
    detail: 'retain, forget, correct, list, get, linkEntity, listEntities',
  },
  {
    name: 'MemoryRetrieval',
    kind: 'class',
    description: 'Read-side of the memory store: hybrid FTS5 + semantic recall, intent classification, bootstrap mode, per-scope budget trimming.',
    detail: 'recall, recallByTag, bootstrap, status',
  },
  {
    name: 'MemoryReflection',
    kind: 'class',
    description: 'Offline consolidation: cluster similar memories, promote high-utility facts to portfolio scope, retire low-reinforcement entries.',
    detail: 'run, lastResult',
  },
  {
    name: 'CrossQuery',
    kind: 'class',
    description: 'Natural-language search across projects, memories, or both — combines identity match and memory semantic recall.',
    detail: 'query',
  },
  {
    name: 'Bootstrap',
    kind: 'class',
    description: 'Project bootstrap: register a new project and create its folder structure from templates, optionally initializing git.',
    detail: 'configure, getConfig, bootstrapProject',
  },
  {
    name: 'HealthAssessor',
    kind: 'class',
    description: 'Per-project and portfolio health assessment across activity, completeness, and outcomes dimensions; worst-tier-wins composite.',
    detail: 'assess, assessPortfolio, invalidateCache',
  },

  // Top-level functions
  {
    name: 'initDb',
    kind: 'function',
    description: 'Initialize the registry SQLite database at the default location (or a provided path) and run schema migrations up to the current version.',
  },
  {
    name: 'connect',
    kind: 'function',
    description: 'Open a better-sqlite3 connection to the registry, applying PRAGMAs (WAL, foreign_keys).',
  },
  {
    name: 'getDbPath',
    kind: 'function',
    description: 'Return the canonical path to the registry database (~/.local/share/project-registry/registry.db).',
  },
  {
    name: 'getTemplateFields',
    kind: 'function',
    description: 'Return the set of extended-field names the schema recognizes as first-class (short_description, medium_description, tech_stack, …).',
  },
  {
    name: 'serializeFieldValue',
    kind: 'function',
    description: 'Serialize an extended-field value (string or array) into the canonical DB representation.',
  },
  {
    name: 'deserializeFieldValue',
    kind: 'function',
    description: 'Inverse of serializeFieldValue: turn a stored extended-field string back into its typed value.',
  },
  {
    name: 'writeFields',
    kind: 'function',
    description: 'Write or update extended fields on a project with producer-attribution semantics (producer-owned fields are not overwritten by other producers).',
  },
  {
    name: 'classifyIntent',
    kind: 'function',
    description: 'Classify a recall query into an intent bucket (retrieve, list, compare, summarize, …) to shape retrieval strategy.',
  },
  {
    name: 'discoverPortsInPath',
    kind: 'function',
    description: 'Scan a project directory for port usage in common config files and return candidate claims for auto-registration.',
  },
  {
    name: 'scanLocations',
    kind: 'function',
    description: 'Migration scan: walk ~/Code and ~/Projects to discover project directories that are candidates for registry registration.',
  },
  {
    name: 'applyProposals',
    kind: 'function',
    description: 'Commit migration proposals from scanLocations into the registry — registers projects, claims ports, enriches fields.',
  },
  {
    name: 'scanMemories',
    kind: 'function',
    description: 'Migration scan: walk Claude Code auto-memory files and fctry memory files to discover importable memory candidates.',
  },
  {
    name: 'applyMemoryMigration',
    kind: 'function',
    description: 'Commit memory migration proposals from scanMemories into the unified memory store, with content-hash dedup.',
  },
  {
    name: 'computeProjectVersion',
    kind: 'function',
    description: 'Compute a stable version string for a project by hashing its tracked documents (spec.md, scenarios.md, …).',
  },
  {
    name: 'listProjectDocuments',
    kind: 'function',
    description: 'Enumerate the documents that feed computeProjectVersion for a given project (paths relative to project root).',
  },

  // Constants
  {
    name: 'SCHEMA_VERSION',
    kind: 'constant',
    description: 'Current registry schema version integer — bumped on every additive or breaking migration.',
  },
  {
    name: 'PORT_RANGE_MIN',
    kind: 'constant',
    description: 'Inclusive lower bound of the auto-allocated port range reserved by the registry.',
  },
  {
    name: 'PORT_RANGE_MAX',
    kind: 'constant',
    description: 'Inclusive upper bound of the auto-allocated port range reserved by the registry.',
  },
  {
    name: 'HEALTH_CACHE_TTL_MS',
    kind: 'constant',
    description: 'TTL in milliseconds for HealthAssessor cached results (so repeated assess calls in one session stay cheap).',
  },

  // Error classes
  {
    name: 'BootstrapNotConfiguredError',
    kind: 'error-class',
    description: 'Thrown by Bootstrap when bootstrapProject is called before configure has set path roots.',
  },
  {
    name: 'BootstrapFolderExistsError',
    kind: 'error-class',
    description: 'Thrown by Bootstrap when the target project folder already exists on disk.',
  },
  {
    name: 'RegistryError',
    kind: 'error-class',
    description: 'Base class for all registry-layer errors; subclassed by specific error types (DuplicateProjectError, NotFoundError, …).',
  },
  {
    name: 'DuplicateProjectError',
    kind: 'error-class',
    description: 'Thrown when registering a project name that already exists in the registry.',
  },
  {
    name: 'NotFoundError',
    kind: 'error-class',
    description: 'Thrown when a named project, capability, or memory cannot be located; carries an optional fuzzy-match suggestion.',
  },
  {
    name: 'EmptyRegistryError',
    kind: 'error-class',
    description: 'Thrown when a required registry operation runs against an uninitialized database.',
  },
  {
    name: 'InvalidInputError',
    kind: 'error-class',
    description: 'Thrown when input to a registry operation fails validation (unknown status, malformed area, cycle detection, …).',
  },

  // Validation & formatting helpers
  {
    name: 'findClosestMatch',
    kind: 'function',
    description: 'Return the closest string from a list of candidates by Levenshtein distance — powers the "did you mean?" suggestion on NotFoundError.',
  },
  {
    name: 'validateStatus',
    kind: 'function',
    description: 'Validate that a status string is allowed for a given project type; throws InvalidInputError otherwise.',
  },
  {
    name: 'toSummary',
    kind: 'function',
    description: 'Format a ProjectRecord into the minimal summary shape returned by listProjects(depth=summary).',
  },
  {
    name: 'toStandard',
    kind: 'function',
    description: 'Format a ProjectRecord into the standard shape that includes extended fields (depth=standard).',
  },
  {
    name: 'toFull',
    kind: 'function',
    description: 'Format a ProjectRecord into the full shape with all extended fields, paths, capabilities, and memory counts (depth=full).',
  },

  // Runtime enumerations and configuration
  {
    name: 'PROJECT_STATUSES',
    kind: 'constant',
    description: 'Set of allowed project status strings across all project types.',
  },
  {
    name: 'STATUS_BY_TYPE',
    kind: 'constant',
    description: 'Map from project type to the allowed status strings for that type.',
  },
  {
    name: 'AREA_NAMES',
    kind: 'constant',
    description: 'Ordered list of canonical area names (Work, Family, Home, Health, Finance, Personal, Infrastructure).',
  },
  {
    name: 'AREA_NAME_SET',
    kind: 'constant',
    description: 'Set form of AREA_NAMES for O(1) membership checks.',
  },
  {
    name: 'UNASSIGNED_AREA_SENTINEL',
    kind: 'constant',
    description: 'Sentinel string "__unassigned__" used by list/search APIs to filter for projects with no area.',
  },
  {
    name: 'MEMORY_TYPES',
    kind: 'constant',
    description: 'Set of allowed memory type strings (decision, outcome, pattern, preference, dependency, correction, learning, context, procedural, observation).',
  },
  {
    name: 'MEMORY_BELIEFS',
    kind: 'constant',
    description: 'Set of allowed belief classifications (fact, opinion, hypothesis).',
  },
  {
    name: 'MEMORY_SCOPES',
    kind: 'constant',
    description: 'Set of allowed memory scopes (project, area, portfolio, global).',
  },
  {
    name: 'DIGEST_KIND_CONFIG',
    kind: 'constant',
    description: 'Per-digest-kind target and ceiling token counts (e.g. essence: target 500–800, ceiling 1200).',
  },

  // Introspection — used by the MCP server's startup self-registration.
  {
    name: 'introspectLibraryExports',
    kind: 'function',
    description: 'Return CapabilityDeclarations for every public @setlist/core export — the input to startup self-registration of the library surface.',
  },

  // Spec 0.26: user-managed areas and project types.
  {
    name: 'AREA_COLOR_PALETTE',
    kind: 'constant',
    description: 'Curated 12-color palette used for areas and project types in the Settings UI.',
  },
  {
    name: 'SEED_AREAS',
    kind: 'constant',
    description: 'Seven seed-default areas inserted on a fresh database (Work, Family, Home, Health, Finance, Personal, Infrastructure). User-owned after init.',
  },
  {
    name: 'isValidAreaColor',
    kind: 'function',
    description: 'Return true if the given color string is in AREA_COLOR_PALETTE.',
  },
  {
    name: 'SEED_PROJECT_TYPES',
    kind: 'constant',
    description: 'Two seed-default project types inserted on a fresh database (Code project → ~/Code with git_init, Non-code project → ~/Projects without).',
  },
  {
    name: 'rowToProjectType',
    kind: 'function',
    description: 'Convert a SQLite project_types row (git_init as 0/1) to the public ProjectType representation (boolean).',
  },
  {
    name: 'InvalidProjectTypeError',
    kind: 'error-class',
    description: 'Thrown when a project_type_id or name does not match any row in the project_types table.',
  },
  {
    name: 'InvalidAreaError',
    kind: 'error-class',
    description: 'Thrown when an area_id or name does not match any row in the areas table.',
  },
  {
    name: 'AreaHasProjectsError',
    kind: 'error-class',
    description: 'Thrown when deleting an area that still has attached projects — the UI must show a reassign flow first.',
  },
  {
    name: 'ProjectTypeHasProjectsError',
    kind: 'error-class',
    description: 'Thrown when deleting a project type that still has attached projects — the UI must show a reassign flow first.',
  },
  {
    name: 'InvalidAreaColorError',
    kind: 'error-class',
    description: 'Thrown when a color is not in AREA_COLOR_PALETTE.',
  },
  {
    name: 'DuplicateAreaNameError',
    kind: 'error-class',
    description: 'Thrown when creating or renaming an area would collide with an existing area name.',
  },
  {
    name: 'DuplicateProjectTypeNameError',
    kind: 'error-class',
    description: 'Thrown when creating or renaming a project type would collide with an existing project-type name.',
  },
];

/**
 * Derive CapabilityDeclarations from the library-export manifest.
 *
 * Pure function: no runtime reflection, no side effects, no module loading.
 */
export function introspectLibraryExports(): CapabilityDeclaration[] {
  return LIBRARY_EXPORTS_MANIFEST.map(entryToDeclaration);
}

function entryToDeclaration(entry: LibraryExportManifestEntry): CapabilityDeclaration {
  return {
    name: entry.name,
    capability_type: 'library',
    description: entry.description,
    inputs: entry.kind,
    outputs: entry.detail ?? '',
    invocation_model: 'library-import',
    audience: 'developer',
  };
}

// Exported for test parity checks — consumers should use introspectLibraryExports().
export const _MANIFEST_FOR_TEST = LIBRARY_EXPORTS_MANIFEST;
