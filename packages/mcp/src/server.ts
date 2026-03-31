import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  Registry, MemoryStore, MemoryRetrieval, MemoryReflection, CrossQuery,
  type CapabilityDeclaration, type QueryDepth,
} from '@setlist/core';

export function createServer(dbPath?: string): Server {
  const registry = new Registry(dbPath);
  const memoryStore = new MemoryStore(dbPath);
  const memoryRetrieval = new MemoryRetrieval(dbPath);
  const crossQuery = new CrossQuery(dbPath);
  const memoryReflection = new MemoryReflection(dbPath);

  const server = new Server(
    { name: 'setlist', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // ── Tool Definitions ──────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // Project Identity (9)
      { name: 'list_projects', description: 'List all projects at a given depth, with optional type/status filters. Suggestion: use get_project() for full details on any project.', inputSchema: { type: 'object' as const, properties: { detail: { type: 'string', enum: ['minimal', 'summary', 'standard', 'full'], default: 'summary' }, type_filter: { type: 'string' }, status_filter: { type: 'string' } } } },
      { name: 'get_project', description: 'Get a single project by name at a given depth. Suggestion: use switch_project() for workspace context.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, detail: { type: 'string', enum: ['minimal', 'summary', 'standard', 'full'], default: 'full' } }, required: ['name'] } },
      { name: 'switch_project', description: 'Look up a project by name and return paths, status, ports, and workspace metadata.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } }, required: ['name'] } },
      { name: 'search_projects', description: 'Search projects by keyword across name, description, goals, and extended fields.', inputSchema: { type: 'object' as const, properties: { query: { type: 'string' }, type_filter: { type: 'string' }, status_filter: { type: 'string' } }, required: ['query'] } },
      { name: 'get_registry_stats', description: 'Return project count, type distribution, and status distribution.', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'register_project', description: 'Register a new project in the registry. Suggestion: use update_project() to modify existing projects.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, display_name: { type: 'string' }, project_type: { type: 'string', default: 'project' }, status: { type: 'string', default: 'active' }, description: { type: 'string' }, goals: { type: 'string' }, paths: { type: 'string' }, producer: { type: 'string', default: 'system' } }, required: ['name'] } },
      { name: 'update_project', description: 'Update core identity fields on an existing project.', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, display_name: { type: 'string' }, status: { type: 'string' }, description: { type: 'string' }, goals: { type: 'string' } }, required: ['name'] } },
      { name: 'archive_project', description: 'Archive a project (releases ports, clears capabilities).', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } }, required: ['name'] } },
      { name: 'batch_update', description: 'Apply field changes to all projects matching a filter. Supports dry_run.', inputSchema: { type: 'object' as const, properties: { type_filter: { type: 'string' }, status_filter: { type: 'string' }, display_name: { type: 'string' }, status: { type: 'string' }, description: { type: 'string' }, goals: { type: 'string' }, dry_run: { type: 'boolean' } } } },
      // Capabilities (2)
      { name: 'register_capabilities', description: 'Write a project\'s complete capability set (replace semantics).', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, capabilities: { type: 'array' } }, required: ['project_name', 'capabilities'] } },
      { name: 'query_capabilities', description: 'Discover capabilities across the ecosystem by project, type, or keyword.', inputSchema: { type: 'object' as const, properties: { project_name: { type: 'string' }, type: { type: 'string' }, keyword: { type: 'string' } } } },
      // Memory Agent (4)
      { name: 'retain', description: 'Store a memory. Suggestion: use recall() to retrieve.', inputSchema: { type: 'object' as const, properties: { content: { type: 'string' }, type: { type: 'string', enum: ['decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'skill'] }, project: { type: 'string' }, scope: { type: 'string', enum: ['project', 'area_of_focus', 'portfolio', 'global'] }, tags: { type: 'array', items: { type: 'string' } }, session_id: { type: 'string' }, agent_role: { type: 'string' } }, required: ['content', 'type'] } },
      { name: 'recall', description: 'Retrieve relevant memories. Omit query for bootstrap mode. Suggestion: use retain() to capture new knowledge.', inputSchema: { type: 'object' as const, properties: { query: { type: 'string' }, project: { type: 'string' }, token_budget: { type: 'number' } } } },
      { name: 'feedback', description: 'Report a build outcome for memory reinforcement.', inputSchema: { type: 'object' as const, properties: { result: { type: 'string', enum: ['success', 'failure'] }, memory_ids: { type: 'array', items: { type: 'string' } } }, required: ['result', 'memory_ids'] } },
      { name: 'memory_status', description: 'Memory store health check. Suggestion: use reflect() for maintenance.', inputSchema: { type: 'object' as const, properties: {} } },
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
    ],
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
          });
          break;
        case 'get_registry_stats':
          result = registry.getRegistryStats();
          break;
        case 'register_project': {
          const paths = typeof a.paths === 'string' ? a.paths.split(',').map(p => p.trim()).filter(Boolean) : undefined;
          registry.register({
            name: a.name as string,
            type: (a.project_type as string ?? 'project') as 'project' | 'area_of_focus',
            status: a.status as string ?? 'active',
            description: a.description as string ?? '',
            goals: a.goals as string ?? '',
            display_name: a.display_name as string ?? '',
            paths,
            producer: a.producer as string ?? 'system',
          });
          result = { result: `Project '${a.name}' registered successfully.` };
          break;
        }
        case 'update_project':
          registry.updateCore(a.name as string, {
            display_name: a.display_name as string | undefined,
            status: a.status as string | undefined,
            description: a.description as string | undefined,
            goals: a.goals as string | undefined,
          });
          result = registry.getProject(a.name as string, 'summary');
          break;
        case 'archive_project': {
          const archiveResult = registry.archiveProject(a.name as string);
          result = { result: `Project '${a.name}' archived.`, ...archiveResult };
          break;
        }
        case 'batch_update':
          result = registry.batchUpdate({
            type_filter: a.type_filter as string | undefined,
            status_filter: a.status_filter as string | undefined,
            display_name: a.display_name as string | undefined,
            status: a.status as string | undefined,
            description: a.description as string | undefined,
            goals: a.goals as string | undefined,
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
