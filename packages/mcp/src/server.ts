import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  Registry, MemoryStore, MemoryRetrieval, MemoryReflection, CrossQuery, Bootstrap,
  HealthAssessor,
  type CapabilityDeclaration, type QueryDepth,
} from '@setlist/core';
import { selfRegisterCapabilities, stderrLogger, SELF_REGISTER_PROJECT, type Logger } from './self-register.js';

/**
 * Shape of one MCP tool registration — a name, human description, and JSON
 * Schema for its inputs. Exported so the introspector can consume the same
 * structure the server dispatches from (single source of truth).
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * The authoritative list of MCP tools this server exposes. This is also what
 * `introspectMcpTools()` reads when building `tool`-typed capability rows
 * during startup self-registration (§2.11). The server's ListTools handler
 * and the startup introspector read this same array — no drift possible.
 */
export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  // Project Identity (14)
  { name: 'list_projects', description: 'List all projects at a given depth, with optional type/status/area filters. Suggestion: use get_project() for full details on any project.', inputSchema: { type: 'object' as const, properties: { detail: { type: 'string', enum: ['minimal', 'summary', 'standard', 'full'], default: 'summary' }, type_filter: { type: 'string' }, status_filter: { type: 'string' }, area_filter: { type: 'string', description: 'Canonical area name (Work/Family/Home/Health/Finance/Personal/Infrastructure) or "__unassigned__" for projects with no area' } } } },
      { name: 'get_project', description: 'Get a single project by name at a given depth. Suggestion: use switch_project() for workspace context.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, detail: { type: 'string', enum: ['minimal', 'summary', 'standard', 'full'], default: 'full' } }, required: ['name'] } },
      { name: 'switch_project', description: 'Look up a project by name and return paths, status, ports, and workspace metadata.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } }, required: ['name'] } },
      { name: 'search_projects', description: 'Search projects by keyword across name, description, goals, and extended fields. Optional area_filter narrows to a single canonical area.', inputSchema: { type: 'object' as const, properties: { query: { type: 'string' }, type_filter: { type: 'string' }, status_filter: { type: 'string' }, area_filter: { type: 'string' } }, required: ['query'] } },
      { name: 'get_registry_stats', description: 'Return project count, type distribution, status distribution, per-area distribution, and unassigned count.', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'register_project', description: 'Register a new project in the registry. Optional area assigns to one of the 7 canonical areas; optional parent_project links as a sub-project. Suggestion: use update_project() to modify existing projects.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, display_name: { type: 'string' }, project_type: { type: 'string', enum: ['project'], default: 'project' }, status: { type: 'string', default: 'active' }, description: { type: 'string' }, goals: { type: 'array', items: { type: 'string' }, description: 'List of goal statements (one per array element). Legacy string input is accepted but arrays are canonical.' }, paths: { type: 'string' }, area: { type: 'string', description: 'Canonical area: Work, Family, Home, Health, Finance, Personal, or Infrastructure' }, parent_project: { type: 'string', description: 'Name of the parent project for sub-project linking' }, producer: { type: 'string', default: 'system' } }, required: ['name'] } },
      { name: 'update_project', description: 'Update core identity fields on an existing project, including optional area and parent_project. Pass null to clear area or parent_project.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, display_name: { type: 'string' }, status: { type: 'string' }, description: { type: 'string' }, goals: { type: 'array', items: { type: 'string' }, description: 'List of goal statements (one per array element).' }, area: { type: ['string', 'null'] }, parent_project: { type: ['string', 'null'] } }, required: ['name'] } },
      { name: 'set_project_area', description: 'Assign or clear a project\'s canonical area. Pass null to move the project to Unassigned.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, area: { type: ['string', 'null'], description: 'Canonical area name or null to clear' } }, required: ['name'] } },
      { name: 'set_parent_project', description: 'Link a child project to a parent project (sub-project relationship). Pass null as parent_name to detach. Rejects self-parenting and cycles.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string', description: 'Child project name' }, parent_name: { type: ['string', 'null'], description: 'Parent project name, or null to detach' } }, required: ['name'] } },
      { name: 'archive_project', description: 'Archive a project (releases ports, clears capabilities). Children are NOT archived and remain linked via parent_archived flag.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } }, required: ['name'] } },
      { name: 'rename_project', description: 'Rename a project atomically (rewrites all references).', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, new_name: { type: 'string' } }, required: ['name', 'new_name'] } },
      { name: 'batch_update', description: 'Apply field changes to all projects matching a filter (type/status/area). Supports dry_run.', inputSchema: { type: 'object' as const, properties: { type_filter: { type: 'string' }, status_filter: { type: 'string' }, area_filter: { type: 'string' }, display_name: { type: 'string' }, status: { type: 'string' }, description: { type: 'string' }, goals: { type: 'array', items: { type: 'string' }, description: 'List of goal statements to write on all matched projects.' }, dry_run: { type: 'boolean' } } } },
      { name: 'enrich_project', description: 'Add structured profile data (goals, topics, entities, concerns) to a project. Union semantics — new items are merged with existing.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, goals: { type: 'array', items: { type: 'string' } }, topics: { type: 'array', items: { type: 'string' } }, entities: { type: 'array', items: { type: 'string' } }, concerns: { type: 'array', items: { type: 'string' } } }, required: ['name'] } },
      { name: 'write_fields', description: 'Write extended fields to a project (short_description, medium_description, tech_stack, etc.). Producer-owned: fields written by one producer are not overwritten by another.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, fields: { type: 'object', description: 'Key-value pairs of field names to values. Values can be strings or arrays.' }, producer: { type: 'string', default: 'system', description: 'Producer identity (e.g., "fctry", "chorus", "user")' } }, required: ['project_name', 'fields'] } },
      // Capabilities (2)
      { name: 'register_capabilities', description: 'Write a project\'s complete capability set (replace semantics).', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, capabilities: { type: 'array' } }, required: ['project_name', 'capabilities'] } },
      { name: 'query_capabilities', description: 'Discover capabilities across the ecosystem by project, type, or keyword.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, type: { type: 'string' }, keyword: { type: 'string' } } } },
      // Memory Agent (5)
      { name: 'retain', description: 'Store a memory. Suggestion: use recall() to retrieve.', inputSchema: { type: 'object' as const, properties: { content: { type: 'string' }, type: { type: 'string', enum: ['decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'learning', 'context', 'procedural', 'observation'] }, project: { type: 'string' }, scope: { type: 'string', enum: ['project', 'area', 'portfolio', 'global'] }, tags: { type: 'array', items: { type: 'string' } }, session_id: { type: 'string' }, agent_role: { type: 'string' }, belief: { type: 'string', enum: ['fact', 'opinion', 'hypothesis'] }, extraction_confidence: { type: 'number' }, valid_from: { type: 'string' }, valid_until: { type: 'string' }, entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' } }, required: ['name', 'type'] } }, parent_version_id: { type: 'string' } }, required: ['content', 'type'] } },
      { name: 'recall', description: 'Retrieve relevant memories. Omit query for bootstrap mode. Suggestion: use retain() to capture new knowledge.', inputSchema: { type: 'object' as const, properties: { query: { type: 'string' }, project: { type: 'string' }, token_budget: { type: 'number' } } } },
      { name: 'feedback', description: 'Report a build outcome for memory reinforcement.', inputSchema: { type: 'object' as const, properties: { result: { type: 'string', enum: ['success', 'failure'] }, memory_ids: { type: 'array', items: { type: 'string' } } }, required: ['result', 'memory_ids'] } },
      { name: 'memory_status', description: 'Memory store health check. Suggestion: use reflect() for maintenance.', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'portfolio_brief', description: 'Structured portfolio snapshot: active projects, portfolio memories, health indicators, pending observations. Use at session start for portfolio-level reasoning.', inputSchema: { type: 'object' as const, properties: {} } },
      // Memory Admin (5)
      { name: 'reflect', description: 'Trigger memory consolidation (admin tool).', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'correct', description: 'Create a correction memory superseding an existing one (admin tool).', inputSchema: { type: 'object' as const, properties: { memory_id: { type: 'string' }, correction: { type: 'string' } }, required: ['memory_id', 'correction'] } },
      { name: 'forget', description: 'Archive a specific memory (admin tool, soft delete).', inputSchema: { type: 'object' as const, properties: { memory_id: { type: 'string' } }, required: ['memory_id'] } },
      { name: 'inspect_memory', description: 'View full memory details including provenance (admin tool).', inputSchema: { type: 'object' as const, properties: { memory_id: { type: 'string' } }, required: ['memory_id'] } },
      { name: 'configure_memory', description: 'Set memory configuration: embedding provider, reflect settings (admin tool).', inputSchema: { type: 'object' as const, properties: { embedding_provider: { type: 'string', enum: ['openai', 'ollama', 'none'] }, reflect_schedule: { type: 'string' }, reflect_threshold: { type: 'number' } } } },
      // Ports (4)
      { name: 'claim_port', description: 'Claim a port for a project\'s service.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, service_label: { type: 'string' }, port: { type: 'number' }, protocol: { type: 'string', default: 'tcp' } }, required: ['project_name', 'service_label'] } },
      { name: 'release_port', description: 'Release a previously claimed port.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, port: { type: 'number' } }, required: ['project_name', 'port'] } },
      { name: 'check_port', description: 'Check whether a port is available or claimed.', inputSchema: { type: 'object' as const, properties: { port: { type: 'number' } }, required: ['port'] } },
      { name: 'discover_ports', description: 'Scan a project\'s config files for port usage and auto-claim.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' } }, required: ['project_name'] } },
      // Tasks (3)
      { name: 'queue_task', description: 'Queue async work. Single project or fan-out dispatch.', inputSchema: { type: 'object' as const, properties: { description: { type: 'string' }, project_name: { type: 'string' }, schedule: { type: 'string', enum: ['now', 'tonight', 'weekly'] }, type_filter: { type: 'string' }, status_filter: { type: 'string' } }, required: ['description', 'schedule'] } },
      { name: 'list_tasks', description: 'List tasks with optional status and project filters.', inputSchema: { type: 'object' as const, properties: { status_filter: { type: 'string' }, project_name: { type: 'string' } } } },
      { name: 'cross_query', description: 'Search across all projects for a natural-language question.', inputSchema: { type: 'object' as const, properties: { query: { type: 'string' }, scope: { type: 'string', enum: ['registry', 'memories', 'all'], default: 'registry' } }, required: ['query'] } },
      // Bootstrap (2)
      { name: 'bootstrap_project', description: 'Create a new project end-to-end: register in registry, create folder, apply templates, init git (code projects). Optional area assigns to a canonical area at registration. Requires configure_bootstrap first.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, project_type: { type: 'string', enum: ['project'], default: 'project' }, status: { type: 'string', default: 'active' }, description: { type: 'string' }, goals: { type: 'string' }, display_name: { type: 'string' }, path_override: { type: 'string' }, skip_git: { type: 'boolean', default: false }, producer: { type: 'string', default: 'bootstrap' }, area: { type: 'string', description: 'Canonical area: Work, Family, Home, Health, Finance, Personal, or Infrastructure' }, parent_project: { type: 'string', description: 'Parent project name for sub-project linking' } }, required: ['name'] } },
      { name: 'configure_bootstrap', description: 'Configure bootstrap: set path roots per project type and template directory. Call with no arguments to view current config.', inputSchema: { type: 'object' as const, properties: { path_roots: { type: 'object', description: 'Mapping of project type to default path root (e.g., {"project": "~/Code", "non_code_project": "~/Projects"})' }, template_dir: { type: 'string', description: 'Path to the template directory' }, archive_path_root: { type: 'string', description: 'Filesystem root where archived projects are moved (e.g., "~/Archive")' } } } },
      // Health (1)
      { name: 'assess_health', description: 'Assess project health. With a name, returns overall tier, per-dimension tiers (activity/completeness/outcomes), and reasons. Without a name, returns a portfolio-wide snapshot ordered worst-to-best plus summary counts. Cached briefly; pass fresh=true to bypass.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, fresh: { type: 'boolean', default: false } } } },
      // Digests (3) — v12
      { name: 'get_project_digest', description: 'Read one project\'s essence digest. Returns { digest_text, spec_version, producer, generated_at, token_count?, stale } or null if no digest exists. Pass current_spec_version to compute staleness (omit to skip stale check).', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, digest_kind: { type: 'string', default: 'essence' }, current_spec_version: { type: 'string', description: 'Optional: the project\'s current spec version. When provided, stale=true iff stored spec_version differs.' } }, required: ['project_name'] } },
      { name: 'get_project_digests', description: 'Batch read project essence digests. Returns a map keyed by project name. Missing projects are omitted unless include_missing=true. include_stale=false filters out digests whose spec_version differs from current_spec_versions[project_name].', inputSchema: { type: 'object' as const, properties: { project_names: { type: 'array', items: { type: 'string' }, description: 'Optional: limit to these projects. Omit for all projects with digests.' }, digest_kind: { type: 'string', default: 'essence' }, include_missing: { type: 'boolean', default: false }, include_stale: { type: 'boolean', default: true }, current_spec_versions: { type: 'object', description: 'Optional: map of project_name to its current spec version, for staleness computation.' } } } },
      { name: 'refresh_project_digest', description: 'Write a project\'s essence digest (replace semantics). Invoked by the CLI generator or any other writer. Rejects writes exceeding the per-kind token ceiling (1200 for essence) with a trim-and-retry error. Returns prior_spec_version when a digest already existed.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, digest_kind: { type: 'string', default: 'essence' }, digest_text: { type: 'string' }, spec_version: { type: 'string' }, producer: { type: 'string', description: 'Free-form identifier for what produced the digest (e.g., "local-qwen3.6-35b-a3b-8bit", "manual").' }, token_count: { type: 'number' } }, required: ['project_name', 'digest_text', 'spec_version', 'producer'] } },
      // Areas (4) — spec 0.26
      { name: 'list_areas', description: 'List all user-managed areas. Returns id, name, display_name, description, color for each row in the areas table.', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'create_area', description: 'Create a new user-managed area. Color must come from the curated 12-color palette. Throws DUPLICATE_AREA_NAME on a name collision and INVALID_AREA_COLOR on an off-palette color.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, display_name: { type: 'string' }, description: { type: 'string' }, color: { type: 'string', description: 'Hex color from AREA_COLOR_PALETTE.' } }, required: ['name', 'color'] } },
      { name: 'update_area', description: 'Update an existing area. Patch-style — undefined fields are left alone. Renames preserve the row id, so memory routing continues to resolve.', inputSchema: { type: 'object' as const, properties: { id: { type: 'number' }, name: { type: 'string' }, display_name: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' } }, required: ['id'] } },
      { name: 'delete_area', description: 'Delete a user-managed area. Throws AREA_HAS_PROJECTS when projects still reference it (the UI shows a reassign flow first).', inputSchema: { type: 'object' as const, properties: { id: { type: 'number' } }, required: ['id'] } },
      // Project types (4) — spec 0.26
      { name: 'list_project_types', description: 'List all user-managed project types. Returns id, name, default_directory, git_init, template_directory, color for each row.', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'create_project_type', description: 'Create a new user-managed project type. default_directory drives bootstrap; git_init controls whether bootstrap initializes a repository. template_directory and color are optional. Throws DUPLICATE_PROJECT_TYPE_NAME on a name collision.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, default_directory: { type: 'string' }, git_init: { type: 'boolean' }, template_directory: { type: ['string', 'null'] }, color: { type: ['string', 'null'] } }, required: ['name', 'default_directory', 'git_init'] } },
      { name: 'update_project_type', description: 'Update an existing project type. Patch-style.', inputSchema: { type: 'object' as const, properties: { id: { type: 'number' }, name: { type: 'string' }, default_directory: { type: 'string' }, git_init: { type: 'boolean' }, template_directory: { type: ['string', 'null'] }, color: { type: ['string', 'null'] } }, required: ['id'] } },
      { name: 'delete_project_type', description: 'Delete a user-managed project type. Throws TYPE_HAS_PROJECTS when projects still reference it.', inputSchema: { type: 'object' as const, properties: { id: { type: 'number' } }, required: ['id'] } },
];

/**
 * Canonical description and placement used when the server auto-creates the
 * setlist project row on first launch against a fresh registry (S115). If
 * the operator has already registered setlist manually, these values are
 * NOT overwritten — auto-create is a safety net, not an authority.
 */
export const SETLIST_CANONICAL_DESCRIPTION =
  'TypeScript implementation of the Project Registry — the active intelligence hub for the user\'s personal ecosystem. Provides project identity, capability declarations, portfolio memory, port allocation, task routing, batch operations, cross-project intelligence, per-project essence digests, and a desktop control panel via a local SQLite database, MCP server, and Electron app.';
export const SETLIST_CANONICAL_AREA = 'Infrastructure';

export interface CreateServerOptions {
  logger?: Logger;
  /**
   * When true, skip first-run auto-create and startup self-registration.
   * Used by tests that need a completely quiet server (no side-effect writes).
   */
  skipSelfRegister?: boolean;
}

export function createServer(dbPath?: string, options: CreateServerOptions = {}): Server {
  const registry = new Registry(dbPath);
  const memoryStore = new MemoryStore(dbPath);
  const memoryRetrieval = new MemoryRetrieval(dbPath);
  const crossQuery = new CrossQuery(dbPath);
  const memoryReflection = new MemoryReflection(dbPath);
  const bootstrapManager = new Bootstrap(dbPath);
  const healthAssessor = new HealthAssessor(dbPath);

  // ── First-run auto-create + self-registration (§2.11, S115) ─
  //
  // The order matters: create the project row BEFORE writing capability rows,
  // because project_capabilities.project_id is a foreign key. Failures here
  // are caught and logged; they never prevent the server from coming up.
  if (!options.skipSelfRegister) {
    const logger = options.logger ?? stderrLogger;
    try {
      const existing = registry.getProject(SELF_REGISTER_PROJECT, 'minimal');
      if (!existing) {
        registry.register({
          name: SELF_REGISTER_PROJECT,
          type: 'project',
          status: 'active',
          description: SETLIST_CANONICAL_DESCRIPTION,
          area: SETLIST_CANONICAL_AREA,
          producer: 'setlist-self-register',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Capability self-registration: setlist project auto-create failed (${msg}); skipping capability registration.`);
      // Fall through: skip self-register if project row couldn't be established.
      options = { ...options, skipSelfRegister: true };
    }
    if (!options.skipSelfRegister) {
      selfRegisterCapabilities(registry, logger);
    }
  }

  const server = new Server(
    { name: 'setlist', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // ── Tool Definitions ──────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOL_DEFINITIONS,
  }));

  // ── Tool Handlers ─────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    try {
      let result: unknown;

      switch (name) {
        // Project Identity
        case 'list_projects':
          result = registry.listProjects({
            depth: ((a.detail as string) ?? 'summary') as QueryDepth,
            type_filter: a.type_filter as string | undefined,
            status_filter: a.status_filter as string | undefined,
            area_filter: a.area_filter as string | undefined,
          });
          break;
        case 'get_project':
          result = registry.getProjectOrThrow(a.name as string, ((a.detail as string) ?? 'full') as QueryDepth);
          break;
        case 'switch_project':
          result = registry.switchProject(a.name as string);
          break;
        case 'search_projects':
          result = registry.searchProjects({
            query: a.query as string,
            type_filter: a.type_filter as string | undefined,
            status_filter: a.status_filter as string | undefined,
            area_filter: a.area_filter as string | undefined,
          });
          break;
        case 'get_registry_stats':
          result = registry.getRegistryStats();
          break;
        case 'register_project': {
          const paths = typeof a.paths === 'string' ? a.paths.split(',').map(p => p.trim()).filter(Boolean) : undefined;
          registry.register({
            name: a.name as string,
            type: 'project',
            status: a.status as string ?? 'active',
            description: a.description as string ?? '',
            goals: a.goals as string | string[] | undefined,
            display_name: a.display_name as string ?? '',
            paths,
            producer: a.producer as string ?? 'system',
            // spec 0.13: optional structural area + parent at registration
            area: a.area as string | null | undefined,
            parent_project: a.parent_project as string | null | undefined,
          });
          result = { result: `Project '${a.name}' registered successfully.` };
          break;
        }
        case 'update_project':
          registry.updateCore(a.name as string, {
            display_name: a.display_name as string | undefined,
            status: a.status as string | undefined,
            description: a.description as string | undefined,
            goals: a.goals as string | string[] | undefined,
            // spec 0.13: allow updating area + parent (null clears)
            area: (a.area === null ? null : a.area as string | undefined),
            parent_project: (a.parent_project === null ? null : a.parent_project as string | undefined),
          });
          result = registry.getProject(a.name as string, 'summary');
          break;
        case 'set_project_area':
          result = registry.setProjectArea(
            a.name as string,
            a.area === null ? null : (a.area as string),
          );
          break;
        case 'set_parent_project':
          result = registry.setParentProject(
            a.name as string,
            a.parent_name === null ? null : (a.parent_name as string),
          );
          break;
        case 'archive_project': {
          const archiveResult = registry.archiveProject(a.name as string);
          result = { result: `Project '${a.name}' archived.`, ...archiveResult };
          break;
        }
        case 'rename_project':
          registry.renameProject(a.name as string, a.new_name as string);
          result = { result: `Project '${a.name}' renamed to '${a.new_name}'.` };
          break;
        case 'enrich_project': {
          const enrichResult = registry.enrichProject(a.name as string, {
            goals: a.goals as string[] | undefined,
            topics: a.topics as string[] | undefined,
            entities: a.entities as string[] | undefined,
            concerns: a.concerns as string[] | undefined,
          });
          result = enrichResult;
          break;
        }
        case 'write_fields': {
          const fields = a.fields as Record<string, unknown>;
          const producer = (a.producer as string) ?? 'system';
          registry.updateFields(a.project_name as string, fields, producer);
          const fieldCount = Object.keys(fields).length;
          result = { result: `${fieldCount} field(s) written to '${a.project_name}' by producer '${producer}'.` };
          break;
        }
        case 'batch_update':
          result = registry.batchUpdate({
            type_filter: a.type_filter as string | undefined,
            status_filter: a.status_filter as string | undefined,
            display_name: a.display_name as string | undefined,
            status: a.status as string | undefined,
            description: a.description as string | undefined,
            goals: a.goals as string | string[] | undefined,
            dry_run: a.dry_run as boolean | undefined,
          });
          break;

        // Capabilities
        case 'register_capabilities': {
          const caps = (a.capabilities as Record<string, unknown>[]).map(c => ({
            name: c.name as string,
            capability_type: (c.capability_type ?? c.type) as string,
            description: (c.description ?? '') as string,
            inputs: c.inputs as string | undefined,
            outputs: c.outputs as string | undefined,
            requires_auth: c.requires_auth as boolean | undefined,
            invocation_model: c.invocation_model as string | undefined,
            audience: c.audience as string | undefined,
          }));
          const count = registry.registerCapabilities(a.project_name as string, caps);
          result = { result: `${count} capabilities registered for '${a.project_name}'.` };
          break;
        }
        case 'query_capabilities':
          result = registry.queryCapabilities({
            project_name: a.project_name as string | undefined,
            capability_type: a.type as string | undefined,
            keyword: a.keyword as string | undefined,
          });
          break;

        // Memory Agent
        case 'retain': {
          const retainResult = memoryStore.retain({
            content: a.content as string,
            type: a.type as string,
            project_id: a.project as string | undefined,
            scope: a.scope as string | undefined,
            tags: a.tags as string[] | undefined,
            session_id: a.session_id as string | undefined,
            agent_role: a.agent_role as string | undefined,
            belief: a.belief as string | undefined,
            extraction_confidence: a.extraction_confidence as number | undefined,
            valid_from: a.valid_from as string | undefined,
            valid_until: a.valid_until as string | undefined,
            entities: a.entities as Array<{ name: string; type: string }> | undefined,
            parent_version_id: a.parent_version_id as string | undefined,
          });
          result = retainResult;
          break;
        }
        case 'recall':
          result = memoryRetrieval.recall({
            query: a.query as string | undefined,
            project_id: a.project as string | undefined,
            token_budget: a.token_budget as number | undefined,
          });
          break;
        case 'feedback':
          result = memoryStore.feedback({
            memory_ids: a.memory_ids as string[],
            outcome: a.result as string,
          });
          break;
        case 'memory_status':
          result = memoryStore.memoryStatus();
          break;
        case 'portfolio_brief':
          result = crossQuery.portfolioBrief();
          break;

        // Memory Admin
        case 'reflect':
          result = memoryReflection.reflect();
          break;
        case 'correct':
          result = memoryStore.correct({
            memory_id: a.memory_id as string,
            new_content: a.correction as string,
            reason: 'User correction',
          });
          break;
        case 'forget':
          result = memoryStore.forget({
            memory_id: a.memory_id as string,
            reason: 'User requested',
          });
          break;
        case 'inspect_memory':
          result = memoryStore.inspectMemory(a.memory_id as string);
          break;
        case 'configure_memory':
          result = memoryStore.configureMemory({
            embedding_provider: a.embedding_provider as string | undefined,
            reflect_schedule: a.reflect_schedule as string | undefined,
            reflect_threshold: a.reflect_threshold as number | undefined,
          });
          break;

        // Ports
        case 'claim_port':
          result = { port: registry.claimPort(
            a.project_name as string,
            a.service_label as string,
            a.port as number | undefined,
            a.protocol as string ?? 'tcp',
          ) };
          break;
        case 'release_port':
          registry.releasePort(a.project_name as string, a.port as number);
          result = { result: `Port ${a.port} released for '${a.project_name}'.` };
          break;
        case 'check_port':
          result = registry.checkPort(a.port as number);
          break;
        case 'discover_ports':
          result = registry.discoverPorts(a.project_name as string);
          break;

        // Tasks
        case 'queue_task':
          result = registry.queueTask({
            description: a.description as string,
            project_name: a.project_name as string | undefined,
            schedule: a.schedule as string,
            type_filter: a.type_filter as string | undefined,
            status_filter: a.status_filter as string | undefined,
          });
          break;
        case 'list_tasks':
          result = registry.listTasks({
            status_filter: a.status_filter as string | undefined,
            project_name: a.project_name as string | undefined,
          });
          break;
        case 'cross_query': {
          const cqResult = crossQuery.query({
            query: a.query as string,
            scope: a.scope as string | undefined,
          });
          result = cqResult;
          break;
        }

        // Bootstrap
        case 'bootstrap_project':
          result = bootstrapManager.bootstrapProject({
            name: a.name as string,
            type: (a.project_type as string ?? 'project') as 'project' | 'non_code_project',
            status: a.status as string | undefined,
            description: a.description as string | undefined,
            goals: a.goals as string | undefined,
            display_name: a.display_name as string | undefined,
            path_override: a.path_override as string | undefined,
            skip_git: a.skip_git as boolean | undefined,
            producer: a.producer as string | undefined,
            area: a.area as string | undefined,
            parent_project: a.parent_project as string | undefined,
          });
          break;
        case 'configure_bootstrap':
          result = bootstrapManager.configureBootstrap({
            path_roots: a.path_roots as Record<string, string> | undefined,
            template_dir: a.template_dir as string | undefined,
            archive_path_root: a.archive_path_root as string | undefined,
          });
          break;

        // Health
        case 'assess_health': {
          const noCache = Boolean(a.fresh);
          const targetName = a.name as string | undefined;
          if (targetName) {
            result = healthAssessor.assessProject(targetName, { noCache });
          } else {
            result = healthAssessor.assessPortfolio({ noCache });
          }
          break;
        }

        // Digests (v12)
        case 'get_project_digest':
          result = registry.getProjectDigest(a.project_name as string, {
            digest_kind: a.digest_kind as string | undefined,
            current_spec_version: a.current_spec_version as string | undefined,
          });
          break;
        case 'get_project_digests':
          result = registry.getProjectDigests({
            project_names: a.project_names as string[] | undefined,
            digest_kind: a.digest_kind as string | undefined,
            include_missing: a.include_missing as boolean | undefined,
            include_stale: a.include_stale as boolean | undefined,
            current_spec_versions: a.current_spec_versions as Record<string, string> | undefined,
          });
          break;
        case 'refresh_project_digest':
          result = registry.refreshProjectDigest({
            project_name: a.project_name as string,
            digest_kind: a.digest_kind as string | undefined,
            digest_text: a.digest_text as string,
            spec_version: a.spec_version as string,
            producer: a.producer as string,
            token_count: a.token_count as number | undefined,
          });
          break;

        // ── Areas (spec 0.26) ────────────────────────────────
        case 'list_areas':
          result = registry.listAreas();
          break;
        case 'create_area':
          result = registry.createArea({
            name: a.name as string,
            display_name: a.display_name as string | undefined,
            description: a.description as string | undefined,
            color: a.color as string,
          });
          break;
        case 'update_area':
          result = registry.updateArea(a.id as number, {
            name: a.name as string | undefined,
            display_name: a.display_name as string | undefined,
            description: a.description as string | undefined,
            color: a.color as string | undefined,
          });
          break;
        case 'delete_area':
          registry.deleteArea(a.id as number);
          result = { ok: true };
          break;

        // ── Project types (spec 0.26) ────────────────────────
        case 'list_project_types':
          result = registry.listProjectTypes();
          break;
        case 'create_project_type':
          result = registry.createProjectType({
            name: a.name as string,
            default_directory: a.default_directory as string,
            git_init: a.git_init as boolean,
            template_directory: (a.template_directory as string | null | undefined) ?? null,
            color: (a.color as string | null | undefined) ?? null,
          });
          break;
        case 'update_project_type':
          result = registry.updateProjectType(a.id as number, {
            name: a.name as string | undefined,
            default_directory: a.default_directory as string | undefined,
            git_init: a.git_init as boolean | undefined,
            template_directory: a.template_directory as string | null | undefined,
            color: a.color as string | null | undefined,
          });
          break;
        case 'delete_project_type':
          registry.deleteProjectType(a.id as number);
          result = { ok: true };
          break;

        default:
          return { content: [{ type: 'text', text: `Error [INVALID_INPUT]: Unknown tool '${name}'.` }] };
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: message }] };
    }
  });

  return server;
}
