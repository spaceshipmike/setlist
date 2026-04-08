import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../src/server.js';

// Helper to call a tool on the server via its internal request handler map
async function callTool(server: ReturnType<typeof createServer>, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const handler = (server as any)._requestHandlers.get('tools/call');
  const response = await handler({ method: 'tools/call', params: { name, arguments: args } }, {});
  const text = response.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function listTools(server: ReturnType<typeof createServer>): Promise<{ name: string }[]> {
  const handler = (server as any)._requestHandlers.get('tools/list');
  const response = await handler({ method: 'tools/list', params: {} }, {});
  return response.tools;
}

describe('MCP Server (S21)', () => {
  let tmpDir: string;
  let dbPath: string;
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-mcp-test-'));
    dbPath = join(tmpDir, 'test.db');
    server = createServer(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Tool Registration ──────────────────────────────────────

  it('registers exactly 33 tools', async () => {
    const tools = await listTools(server);
    expect(tools).toHaveLength(33);
  });

  it('registers all expected tool names', async () => {
    const tools = await listTools(server);
    const names = tools.map(t => t.name).sort();
    expect(names).toEqual([
      'archive_project', 'batch_update', 'bootstrap_project', 'check_port', 'claim_port',
      'configure_bootstrap', 'configure_memory', 'correct', 'cross_query', 'discover_ports',
      'enrich_project', 'feedback', 'forget', 'get_project', 'get_registry_stats',
      'inspect_memory', 'list_projects', 'list_tasks', 'memory_status',
      'portfolio_brief', 'queue_task', 'recall', 'reflect', 'register_capabilities',
      'register_project', 'release_port', 'rename_project', 'retain',
      'search_projects', 'switch_project', 'update_project', 'query_capabilities',
      'write_fields',
    ].sort());
  });

  // ── Project Identity Tools ─────────────────────────────────

  it('register_project creates a queryable project', async () => {
    const reg = await callTool(server, 'register_project', {
      name: 'test-proj', display_name: 'Test Project',
      project_type: 'project', status: 'active',
      description: 'A test project', goals: 'Testing',
    }) as Record<string, unknown>;
    expect(reg.result).toContain('registered');

    const proj = await callTool(server, 'get_project', { name: 'test-proj' }) as Record<string, unknown>;
    expect(proj.name).toBe('test-proj');
    expect(proj.display_name).toBe('Test Project');
    expect(proj.description).toBe('A test project');
  });

  it('list_projects returns registered projects at requested depth', async () => {
    await callTool(server, 'register_project', { name: 'p1', description: 'First' });
    await callTool(server, 'register_project', { name: 'p2', description: 'Second' });

    const summary = await callTool(server, 'list_projects', { detail: 'summary' }) as Record<string, unknown>[];
    expect(summary).toHaveLength(2);
    expect(summary[0]).toHaveProperty('name');
    expect(summary[0]).toHaveProperty('status');
    // Summary should not have created_at
    expect(summary[0]).not.toHaveProperty('created_at');
  });

  it('get_project returns NOT_FOUND error with fuzzy suggestion', async () => {
    await callTool(server, 'register_project', { name: 'project-registry-service' });

    const result = await callTool(server, 'get_project', { name: 'project-registy' }) as string;
    expect(result).toContain('NOT_FOUND');
    expect(result).toContain('project-registry-service');
  });

  it('switch_project returns full context with ports', async () => {
    await callTool(server, 'register_project', { name: 'my-proj', paths: '/tmp/my-proj' });
    await callTool(server, 'claim_port', { project_name: 'my-proj', service_label: 'dev', port: 3000 });

    const ctx = await callTool(server, 'switch_project', { name: 'my-proj' }) as Record<string, unknown>;
    expect(ctx.name).toBe('my-proj');
    expect(ctx.paths).toContain('/tmp/my-proj');
    expect(ctx.ports).toHaveLength(1);
  });

  it('search_projects finds matching projects', async () => {
    await callTool(server, 'register_project', { name: 'auth-service', description: 'Authentication microservice' });
    await callTool(server, 'register_project', { name: 'web-app', description: 'Frontend application' });

    const results = await callTool(server, 'search_projects', { query: 'authentication' }) as Record<string, unknown>[];
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('auth-service');
  });

  it('get_registry_stats returns correct counts', async () => {
    await callTool(server, 'register_project', { name: 'p1' });
    await callTool(server, 'register_project', { name: 'p2', project_type: 'area_of_focus' });

    const stats = await callTool(server, 'get_registry_stats') as Record<string, unknown>;
    expect(stats.total).toBe(2);
    expect((stats.by_type as Record<string, number>).project).toBe(1);
    expect((stats.by_type as Record<string, number>).area_of_focus).toBe(1);
  });

  it('update_project changes fields and returns updated summary', async () => {
    await callTool(server, 'register_project', { name: 'up', description: 'Old' });

    const updated = await callTool(server, 'update_project', { name: 'up', description: 'New' }) as Record<string, unknown>;
    expect(updated.description).toBe('New');
  });

  it('archive_project releases ports and clears capabilities', async () => {
    await callTool(server, 'register_project', { name: 'arch' });
    await callTool(server, 'claim_port', { project_name: 'arch', service_label: 'dev', port: 4000 });
    await callTool(server, 'register_capabilities', {
      project_name: 'arch',
      capabilities: [{ name: 'tool1', capability_type: 'mcp-tool', description: 'Test' }],
    });

    const result = await callTool(server, 'archive_project', { name: 'arch' }) as Record<string, unknown>;
    expect(result.ports_released).toBe(1);
    expect(result.capabilities_cleared).toBe(1);
  });

  it('rename_project renames and rewrites all references', async () => {
    await callTool(server, 'register_project', { name: 'old-proj', description: 'Test' });
    await callTool(server, 'claim_port', { project_name: 'old-proj', service_label: 'dev', port: 4100 });

    const result = await callTool(server, 'rename_project', { name: 'old-proj', new_name: 'new-proj' }) as Record<string, unknown>;
    expect(result.result).toContain('renamed');

    const proj = await callTool(server, 'get_project', { name: 'new-proj' }) as Record<string, unknown>;
    expect(proj.name).toBe('new-proj');

    const check = await callTool(server, 'check_port', { port: 4100 }) as Record<string, unknown>;
    expect(check.project).toBe('new-proj');

    const oldResult = await callTool(server, 'get_project', { name: 'old-proj' }) as string;
    expect(oldResult).toContain('NOT_FOUND');
  });

  it('batch_update applies changes to filtered projects', async () => {
    await callTool(server, 'register_project', { name: 'b1', status: 'active' });
    await callTool(server, 'register_project', { name: 'b2', status: 'paused' });

    const result = await callTool(server, 'batch_update', {
      status_filter: 'paused', status: 'archived',
    }) as Record<string, unknown>;
    expect(result.count).toBe(1);
    expect(result.projects).toContain('b2');
  });

  // ── Capability Tools ───────────────────────────────────────

  it('register_capabilities and query_capabilities round-trip', async () => {
    await callTool(server, 'register_project', { name: 'cap-proj' });
    await callTool(server, 'register_capabilities', {
      project_name: 'cap-proj',
      capabilities: [
        { name: 'search', capability_type: 'mcp-tool', description: 'Full-text search' },
        { name: 'api', capability_type: 'rest-endpoint', description: 'REST API' },
      ],
    });

    const byProject = await callTool(server, 'query_capabilities', { project_name: 'cap-proj' }) as Record<string, unknown>[];
    expect(byProject).toHaveLength(2);

    const byType = await callTool(server, 'query_capabilities', { type: 'mcp-tool' }) as Record<string, unknown>[];
    expect(byType).toHaveLength(1);
    expect(byType[0].name).toBe('search');

    const byKeyword = await callTool(server, 'query_capabilities', { keyword: 'REST' }) as Record<string, unknown>[];
    expect(byKeyword).toHaveLength(1);
  });

  // ── Memory Tools ───────────────────────────────────────────

  it('retain creates a memory and recall retrieves it', async () => {
    const retained = await callTool(server, 'retain', {
      content: 'Use SQLite for storage', type: 'decision', project: 'my-proj',
    }) as Record<string, unknown>;
    expect(retained.memory_id).toBeTruthy();
    expect(retained.is_new).toBe(true);

    const recalled = await callTool(server, 'recall', {
      query: 'SQLite storage', project: 'my-proj',
    }) as Record<string, unknown>[];
    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0].content).toContain('SQLite');
  });

  it('retain deduplicates identical content', async () => {
    const first = await callTool(server, 'retain', { content: 'Use Postgres', type: 'decision' }) as Record<string, unknown>;
    const second = await callTool(server, 'retain', { content: 'Use Postgres', type: 'decision' }) as Record<string, unknown>;

    expect(first.memory_id).toBe(second.memory_id);
    expect(second.is_new).toBe(false);
    expect(second.reinforcement_count).toBe(2);
  });

  it('feedback updates outcome scores', async () => {
    const mem = await callTool(server, 'retain', { content: 'Pattern X', type: 'pattern' }) as Record<string, unknown>;

    const fb = await callTool(server, 'feedback', {
      result: 'success', memory_ids: [mem.memory_id],
    }) as Record<string, unknown>;
    expect(fb.updated_count).toBe(1);
    expect((fb.new_scores as Record<string, number>)[mem.memory_id as string]).toBeGreaterThan(0);
  });

  it('memory_status returns health summary', async () => {
    await callTool(server, 'retain', { content: 'A decision', type: 'decision' });

    const status = await callTool(server, 'memory_status') as Record<string, unknown>;
    expect(status.total).toBe(1);
    expect((status.counts_by_type as Record<string, number>).decision).toBe(1);
    expect(status.embedding_provider).toBe('none');
  });

  it('correct creates correction and archives original', async () => {
    const orig = await callTool(server, 'retain', { content: 'Use MySQL', type: 'decision' }) as Record<string, unknown>;

    const correction = await callTool(server, 'correct', {
      memory_id: orig.memory_id, correction: 'Actually use Postgres',
    }) as Record<string, unknown>;
    expect(correction.correction_id).toBeTruthy();
    expect(correction.superseded_id).toBe(orig.memory_id);
    expect(correction.edge_id).toBeTruthy();
  });

  it('forget archives a memory', async () => {
    const mem = await callTool(server, 'retain', { content: 'Temp note', type: 'outcome' }) as Record<string, unknown>;

    const result = await callTool(server, 'forget', { memory_id: mem.memory_id }) as Record<string, unknown>;
    expect(result.status).toBe('archived');
  });

  it('inspect_memory returns full provenance', async () => {
    const mem = await callTool(server, 'retain', { content: 'Inspect me', type: 'decision' }) as Record<string, unknown>;

    const inspection = await callTool(server, 'inspect_memory', { memory_id: mem.memory_id }) as Record<string, unknown>;
    expect(inspection.memory).toBeTruthy();
    expect(inspection.versions).toBeTruthy();
    expect(inspection.edges).toBeTruthy();
  });

  it('configure_memory sets embedding provider', async () => {
    const config = await callTool(server, 'configure_memory', { embedding_provider: 'none' }) as Record<string, string>;
    expect(config.embedding_provider).toBe('none');
  });

  it('reflect runs consolidation cycle', async () => {
    await callTool(server, 'retain', { content: 'Something to reflect on', type: 'decision' });

    const result = await callTool(server, 'reflect') as Record<string, unknown>;
    expect(result).toHaveProperty('memories_archived');
    expect(result).toHaveProperty('edges_created');
    expect(result).toHaveProperty('summary_blocks_rewritten');
    expect(result).toHaveProperty('duration_ms');
  });

  // ── Port Tools ─────────────────────────────────────────────

  it('claim_port, check_port, release_port lifecycle', async () => {
    await callTool(server, 'register_project', { name: 'port-proj' });

    const claimed = await callTool(server, 'claim_port', {
      project_name: 'port-proj', service_label: 'dev server', port: 5000,
    }) as Record<string, unknown>;
    expect(claimed.port).toBe(5000);

    const check = await callTool(server, 'check_port', { port: 5000 }) as Record<string, unknown>;
    expect(check.available).toBe(false);
    expect(check.project).toBe('port-proj');

    await callTool(server, 'release_port', { project_name: 'port-proj', port: 5000 });

    const checkAfter = await callTool(server, 'check_port', { port: 5000 }) as Record<string, unknown>;
    expect(checkAfter.available).toBe(true);
  });

  it('discover_ports returns discovery result', async () => {
    await callTool(server, 'register_project', { name: 'disc-proj', paths: tmpDir });

    const result = await callTool(server, 'discover_ports', { project_name: 'disc-proj' }) as Record<string, unknown>;
    expect(result).toHaveProperty('claimed');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('summary');
  });

  // ── Task Tools ─────────────────────────────────────────────

  it('queue_task and list_tasks lifecycle', async () => {
    await callTool(server, 'register_project', { name: 'task-proj' });

    const queued = await callTool(server, 'queue_task', {
      description: 'Update docs', project_name: 'task-proj', schedule: 'now',
    }) as Record<string, unknown>;
    expect(queued.task_id).toBeTruthy();

    const tasks = await callTool(server, 'list_tasks', { status_filter: 'pending' }) as Record<string, unknown>[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Update docs');
  });

  it('cross_query searches across projects', async () => {
    await callTool(server, 'register_project', {
      name: 'cq-proj', description: 'Uses SQLite for data storage',
    });

    const result = await callTool(server, 'cross_query', {
      query: 'SQLite', scope: 'registry',
    }) as Record<string, unknown>;
    expect(result.results).toBeTruthy();
    expect(result.summary).toBeTruthy();
  });

  // ── Error Handling ─────────────────────────────────────────

  it('unknown tool returns INVALID_INPUT error', async () => {
    const result = await callTool(server, 'nonexistent_tool') as string;
    expect(result).toContain('INVALID_INPUT');
  });

  it('errors include structured error messages', async () => {
    const result = await callTool(server, 'get_project', { name: 'no-such-project' }) as string;
    expect(result).toContain('NOT_FOUND');
  });
});
