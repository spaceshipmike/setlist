import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../src/server.js';
import {
  ONBOARDING_DOC,
  ONBOARDING_INSTRUCTIONS,
  ONBOARDING_RESOURCE_NAME,
  ONBOARDING_RESOURCE_URI,
} from '../src/onboarding.js';

type ServerWithHandlers = ReturnType<typeof createServer> & {
  _requestHandlers: Map<string, (req: unknown, extra: unknown) => Promise<unknown>>;
};

async function callHandler<T>(
  server: ReturnType<typeof createServer>,
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const handler = (server as ServerWithHandlers)._requestHandlers.get(method);
  if (!handler) throw new Error(`no handler registered for ${method}`);
  return (await handler({ method, params }, {})) as T;
}

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace, drop empty
  // strings, and trim each result. Heading lines and list bullets in the doc
  // also count as sentence-equivalent units for duplication checking.
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 8); // ignore single-word fragments
}

describe('Onboarding instructions on initialize (S135)', () => {
  let tmpDir: string;
  let dbPath: string;
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-onboarding-test-'));
    dbPath = join(tmpDir, 'test.db');
    server = createServer(dbPath, { skipSelfRegister: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the instructions paragraph at the protocol level on initialize', async () => {
    const result = await callHandler<{ instructions?: string; capabilities: Record<string, unknown> }>(
      server,
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' },
      },
    );
    expect(result.instructions).toBeTruthy();
    expect(result.instructions).toBe(ONBOARDING_INSTRUCTIONS);
  });

  it('declares both tools and resources capabilities', async () => {
    const result = await callHandler<{ capabilities: Record<string, unknown> }>(server, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.0' },
    });
    expect(result.capabilities.tools).toBeDefined();
    expect(result.capabilities.resources).toBeDefined();
  });

  it('keeps the instructions paragraph under 150 words', () => {
    const wordCount = ONBOARDING_INSTRUCTIONS.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThan(150);
  });

  it('names the four core action verbs in order', () => {
    const lower = ONBOARDING_INSTRUCTIONS.toLowerCase();
    const verbs = ['register_project', 'enrich_project', 'write_fields', 'refresh_project_digest'];
    let lastIdx = -1;
    for (const v of verbs) {
      const idx = lower.indexOf(v);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('names the capability item shape with all three required fields', () => {
    const text = ONBOARDING_INSTRUCTIONS;
    expect(text).toContain('name');
    expect(text).toContain('capability_type');
    expect(text).toContain('description');
  });

  it('points at the onboarding resource URI', () => {
    expect(ONBOARDING_INSTRUCTIONS).toContain(ONBOARDING_RESOURCE_URI);
  });

  it('does not embed MCP tool schemas, full field documentation, or example payloads', () => {
    // Heuristic: the paragraph must not contain JSON-Schema markers, code
    // fences, or the longer field-tier guidance that lives in the doc.
    expect(ONBOARDING_INSTRUCTIONS).not.toContain('"type":');
    expect(ONBOARDING_INSTRUCTIONS).not.toContain('```');
    expect(ONBOARDING_INSTRUCTIONS).not.toContain('## ');
    // Field-tier prose ("Used in portfolio briefs") only appears in the doc.
    expect(ONBOARDING_INSTRUCTIONS).not.toContain('portfolio briefs');
  });

  it('returns the same instructions when the registry is empty', async () => {
    // No projects registered, no portfolio state. The bootstrap path must
    // not depend on anything except the constant.
    const result = await callHandler<{ instructions?: string }>(server, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'fresh-client', version: '0.0.0' },
    });
    expect(result.instructions).toBe(ONBOARDING_INSTRUCTIONS);
  });
});

describe('Onboarding resource via list/read (S137)', () => {
  let tmpDir: string;
  let dbPath: string;
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-onboarding-test-'));
    dbPath = join(tmpDir, 'test.db');
    server = createServer(dbPath, { skipSelfRegister: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists the onboarding resource with a human-readable name and markdown mime type', async () => {
    const result = await callHandler<{ resources: { uri: string; name: string; mimeType?: string }[] }>(
      server,
      'resources/list',
      {},
    );
    const onboarding = result.resources.find(r => r.uri === ONBOARDING_RESOURCE_URI);
    expect(onboarding).toBeDefined();
    expect(onboarding?.name).toBe(ONBOARDING_RESOURCE_NAME);
    expect(onboarding?.mimeType).toBe('text/markdown');
  });

  it('serves the full enrichment guide on resources/read', async () => {
    const result = await callHandler<{
      contents: { uri: string; mimeType?: string; text?: string }[];
    }>(server, 'resources/read', { uri: ONBOARDING_RESOURCE_URI });
    expect(result.contents.length).toBeGreaterThan(0);
    const first = result.contents[0];
    expect(first.uri).toBe(ONBOARDING_RESOURCE_URI);
    expect(first.mimeType).toBe('text/markdown');
    expect(first.text).toBeTruthy();
    expect(first.text).toBe(ONBOARDING_DOC);
  });

  it('covers the four-step workflow, profile fields, structured-fields tier, capability shape, digest refresh, and "good description" subsection', () => {
    expect(ONBOARDING_DOC).toContain('register_project');
    expect(ONBOARDING_DOC).toContain('enrich_project');
    expect(ONBOARDING_DOC).toContain('write_fields');
    expect(ONBOARDING_DOC).toContain('refresh_project_digest');
    expect(ONBOARDING_DOC).toContain('goals');
    expect(ONBOARDING_DOC).toContain('topics');
    expect(ONBOARDING_DOC).toContain('entities');
    expect(ONBOARDING_DOC).toContain('concerns');
    expect(ONBOARDING_DOC).toContain('short_description');
    expect(ONBOARDING_DOC).toContain('medium_description');
    expect(ONBOARDING_DOC).toContain('readme_description');
    expect(ONBOARDING_DOC).toContain('tech_stack');
    expect(ONBOARDING_DOC).toContain('patterns');
    expect(ONBOARDING_DOC).toContain('register_capabilities');
    expect(ONBOARDING_DOC).toContain('capability_type');
    expect(ONBOARDING_DOC).toContain('digest');
    expect(ONBOARDING_DOC).toMatch(/good description/i);
  });

  it('throws on unknown resource URIs', async () => {
    await expect(
      callHandler(server, 'resources/read', { uri: 'setlist://docs/does-not-exist' }),
    ).rejects.toThrow(/Unknown resource URI/);
  });

  it('does not duplicate any sentence from the doc verbatim in the instructions', () => {
    const docSentences = new Set(splitSentences(ONBOARDING_DOC));
    const instructionSentences = splitSentences(ONBOARDING_INSTRUCTIONS);
    for (const s of instructionSentences) {
      expect(docSentences.has(s)).toBe(false);
    }
  });
});
