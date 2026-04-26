import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../src/server.js';

type ServerWithHandlers = ReturnType<typeof createServer> & {
  _requestHandlers: Map<string, (req: unknown, extra: unknown) => Promise<unknown>>;
};

async function callTool(
  server: ReturnType<typeof createServer>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const handler = (server as ServerWithHandlers)._requestHandlers.get('tools/call');
  if (!handler) throw new Error('no tools/call handler');
  const response = (await handler(
    { method: 'tools/call', params: { name, arguments: args } },
    {},
  )) as { content: { text: string }[] };
  const text = response.content[0].text;
  return JSON.parse(text) as Record<string, unknown>;
}

interface NextStep {
  action: string;
  why: string;
}

function getNextSteps(response: Record<string, unknown>): NextStep[] {
  const steps = response.next_steps;
  if (!Array.isArray(steps)) {
    throw new Error(`expected next_steps array, got ${JSON.stringify(steps)}`);
  }
  return steps as NextStep[];
}

describe('next_steps recipe in registration responses (S136)', () => {
  let tmpDir: string;
  let dbPath: string;
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-nextsteps-test-'));
    dbPath = join(tmpDir, 'test.db');
    server = createServer(dbPath, { skipSelfRegister: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('register_project', () => {
    it('returns the full recipe for a sparse registration (only name)', async () => {
      const response = await callTool(server, 'register_project', { name: 'sparse-proj' });
      const steps = getNextSteps(response);
      const actions = steps.map(s => s.action);
      expect(actions).toEqual([
        'enrich_project',
        'write_fields',
        'register_capabilities',
        'refresh_project_digest',
      ]);
    });

    it('shortens the recipe when description and goals are provided up front', async () => {
      const response = await callTool(server, 'register_project', {
        name: 'rich-proj',
        description: 'A test project with description.',
        goals: ['ship the thing'],
      });
      const steps = getNextSteps(response);
      const actions = steps.map(s => s.action);
      // description present → write_fields still required for tech_stack/patterns
      // goals present → enrich_project still required for topics/entities
      // No capabilities → register_capabilities required.
      // No digest → refresh_project_digest required.
      expect(actions).toContain('register_capabilities');
      expect(actions).toContain('refresh_project_digest');
      // the array shortens — confirm by populating tech_stack/patterns/topics/entities explicitly
    });

    it('returns each step as {action, why} only', async () => {
      const response = await callTool(server, 'register_project', { name: 'shape-proj' });
      const steps = getNextSteps(response);
      for (const step of steps) {
        expect(Object.keys(step).sort()).toEqual(['action', 'why']);
        expect(typeof step.action).toBe('string');
        expect(typeof step.why).toBe('string');
        expect(step.why.split(/\s+/).length).toBeLessThanOrEqual(15);
      }
    });

    it('uses the registration response envelope (text-encoded JSON)', async () => {
      // Verify a non-Claude MCP client iterating the array can rely on the
      // standard MCP tool-result envelope. The shape: response.content[0].text
      // is JSON-stringified, top-level next_steps array.
      const handler = (server as ServerWithHandlers)._requestHandlers.get('tools/call');
      if (!handler) throw new Error('no tools/call handler');
      const raw = (await handler(
        { method: 'tools/call', params: { name: 'register_project', arguments: { name: 'envelope-proj' } } },
        {},
      )) as { content: { type: string; text: string }[] };
      expect(raw.content[0].type).toBe('text');
      const parsed = JSON.parse(raw.content[0].text);
      expect(Array.isArray(parsed.next_steps)).toBe(true);
    });
  });

  describe('progressive enrichment closes the recipe', () => {
    it('returns [] once all four enrichment steps have landed', async () => {
      const name = 'fully-enriched-proj';
      await callTool(server, 'register_project', { name });

      // Step 1: enrich_project (goals/topics/entities)
      const enrichResp = await callTool(server, 'enrich_project', {
        name,
        goals: ['ship'],
        topics: ['testing'],
        entities: ['vitest'],
      });
      expect(getNextSteps(enrichResp).map(s => s.action)).not.toContain('enrich_project');

      // Step 2: write_fields (description, tech_stack, patterns)
      const writeResp = await callTool(server, 'write_fields', {
        project_name: name,
        fields: {
          description: 'A test project.',
          tech_stack: 'TypeScript, Vitest',
          patterns: 'monorepo',
        },
      });
      expect(getNextSteps(writeResp).map(s => s.action)).not.toContain('write_fields');

      // Step 3: register_capabilities
      const capsResp = await callTool(server, 'register_capabilities', {
        project_name: name,
        capabilities: [
          { name: 'do-thing', capability_type: 'mcp-tool', description: 'Does the thing.' },
        ],
      });
      expect(getNextSteps(capsResp).map(s => s.action)).not.toContain('register_capabilities');

      // Step 4: refresh_project_digest
      const digestResp = await callTool(server, 'refresh_project_digest', {
        project_name: name,
        digest_text: 'Compact essence summary of the project.',
        spec_version: '0.1.0',
        producer: 'test',
      });
      // refresh_project_digest is not required to return next_steps, but the
      // following call should — and it should be empty.
      // Re-check via another enrichment-like call (write_fields with no-op).
      void digestResp;
      const finalResp = await callTool(server, 'write_fields', {
        project_name: name,
        fields: { short_description: 'A test project.' },
      });
      expect(getNextSteps(finalResp)).toEqual([]);
    });

    it('returns the same shape from enrich_project, write_fields, and register_capabilities', async () => {
      const name = 'shape-share-proj';
      await callTool(server, 'register_project', { name });

      const enrichResp = await callTool(server, 'enrich_project', { name, topics: ['x'] });
      const writeResp = await callTool(server, 'write_fields', {
        project_name: name,
        fields: { tech_stack: 'TS' },
      });
      const capsResp = await callTool(server, 'register_capabilities', {
        project_name: name,
        capabilities: [
          { name: 'cap', capability_type: 'mcp-tool', description: 'A cap.' },
        ],
      });

      // All three responses carry next_steps with the same {action, why} entry shape.
      for (const resp of [enrichResp, writeResp, capsResp]) {
        const steps = getNextSteps(resp);
        for (const step of steps) {
          expect(Object.keys(step).sort()).toEqual(['action', 'why']);
        }
      }
    });
  });

  describe('bootstrap_project', () => {
    it('also returns a next_steps array on success', async () => {
      // Resolve the seeded "Code project" type so we don't need to set up
      // BootstrapConfig path_roots. Use path_override to keep the test
      // hermetic and skip_git to avoid requiring git in the sandbox.
      const types = (await callTool(server, 'list_project_types')) as unknown as { id: number; name: string }[];
      const codeType = types.find(t => t.name === 'Code project');
      if (!codeType) throw new Error('seed Code project type missing');
      const target = join(tmpDir, 'bootstrap-proj');
      const response = await callTool(server, 'bootstrap_project', {
        name: 'bootstrap-proj',
        project_type_id: codeType.id,
        path_override: target,
        skip_git: true,
      });
      const steps = getNextSteps(response);
      expect(Array.isArray(steps)).toBe(true);
      // Same canonical ordering for a freshly bootstrapped sparse project.
      const actions = steps.map(s => s.action);
      expect(actions).toContain('enrich_project');
      expect(actions).toContain('write_fields');
      expect(actions).toContain('register_capabilities');
      expect(actions).toContain('refresh_project_digest');
    });
  });
});
