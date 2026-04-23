import { readFile, access } from 'node:fs/promises';
import { join, dirname, resolve as pathResolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Registry, computeProjectVersion, listProjectDocuments } from '@setlist/core';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_FLASH_LITE = 'google/gemini-2.5-flash-lite';
const OPENROUTER_FLASH = 'google/gemini-2.5-flash';

const LOCAL_BASE_URL = process.env.SETLIST_DIGEST_BASE_URL ?? 'http://m4-pro.local:8000/v1';
const LOCAL_MODEL = process.env.SETLIST_DIGEST_MODEL ?? 'mlx-community/Qwen3.6-35B-A3B-8bit';

// Hosted providers get the full spec; local path truncates at ~100k tokens.
const LOCAL_MAX_SOURCE_CHARS = 400_000;

const TARGET_MIN = 500;
const TARGET_MAX = 800;
const CEILING = 1200;

type ProviderName = 'openrouter-flash-lite' | 'openrouter-flash' | 'local-mlx';

interface ProviderCall {
  provider: ProviderName;
  model: string;
  url: string;
  headers: Record<string, string>;
  truncateSource: boolean;
}

const SYSTEM_PROMPT = `You produce project essence summaries for the setlist project registry.

Your job: read a project's fctry spec (or CLAUDE.md / README.md fallback, or concatenated markdown extracted from the project's documents) and write a dense, factual summary of what the project is today. The summary is stored as a free-form text blob and used for embedding, semantic matching against external references, and drop-in context for cross-project questions.

Content requirements:
- **Target ${TARGET_MIN}–${TARGET_MAX} tokens.** Hard ceiling ${CEILING}. Stay inside the target range. If you need to trim, drop boilerplate first.
- **Describe current state only.** Omit historical context, port origins, retired peer implementations, and claims about deprecated or archived components unless they constrain current behavior. If the source contains port-era framing or "originally a port of X" language, reflect what the project *is today*, not what it *came from*.
- **Factual and dense; no marketing voice.** Strip phrases like "at the center of the user's personal ecosystem," "directly operable," "invisible infrastructure." Claims must be concrete and capability-specific.
- **Name unbuilt sections explicitly.** The digest is used to match external references against projects that could benefit from them; references are most valuable for unbuilt work, so call out what's specced-but-not-built, what's in progress, and what's explicitly deferred.
- **Structure: one paragraph per major surface.** No bullet lists. No section headers. No markdown.
- **Do not invent facts.** If the source doesn't name something, don't name it. If you're uncertain whether a capability is current or historical, omit it.

Respond with only the digest text. Do not preface it, do not label it, do not wrap it in code fences or quotes.`;

function approxTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function selectProvider(): ProviderName {
  const explicit = (process.env.SETLIST_DIGEST_PROVIDER ?? '').trim() as ProviderName | '';
  if (explicit === 'openrouter-flash-lite' || explicit === 'openrouter-flash' || explicit === 'local-mlx') {
    return explicit;
  }
  if (process.env.SETLIST_OPENROUTER_API_KEY) return 'openrouter-flash-lite';
  return 'local-mlx';
}

function buildProviderCall(provider: ProviderName): ProviderCall {
  if (provider === 'openrouter-flash-lite' || provider === 'openrouter-flash') {
    const apiKey = process.env.SETLIST_OPENROUTER_API_KEY ?? '';
    const model = provider === 'openrouter-flash-lite' ? OPENROUTER_FLASH_LITE : OPENROUTER_FLASH;
    return {
      provider,
      model,
      url: OPENROUTER_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/mikelebowitz/setlist',
        'X-Title': 'setlist-digest-generator',
      },
      truncateSource: false,
    };
  }
  return {
    provider: 'local-mlx',
    model: LOCAL_MODEL,
    url: `${LOCAL_BASE_URL.replace(/\/$/, '')}/chat/completions`,
    headers: { 'Content-Type': 'application/json' },
    truncateSource: true,
  };
}

interface LlmResponse {
  digest: string;
  tokenCount: number;
}

async function callLLM(
  call: ProviderCall,
  sourceText: string,
  projectName: string,
  retryInstruction?: string,
): Promise<LlmResponse> {
  let effectiveSource = sourceText;
  if (call.truncateSource && effectiveSource.length > LOCAL_MAX_SOURCE_CHARS) {
    console.error(
      `  [digest] ${projectName}: head-truncating source from ${effectiveSource.length} to ${LOCAL_MAX_SOURCE_CHARS} chars for local provider`,
    );
    effectiveSource = effectiveSource.slice(0, LOCAL_MAX_SOURCE_CHARS);
  }
  const system = retryInstruction ? `${SYSTEM_PROMPT}\n\n${retryInstruction}` : SYSTEM_PROMPT;
  const body = {
    model: call.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Project: ${projectName}\n\nSource:\n\n${effectiveSource}` },
    ],
    temperature: 0.2,
    max_tokens: 6000,
  };
  const response = await fetch(call.url, {
    method: 'POST',
    headers: call.headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const snippet = await response.text().catch(() => '');
    throw new Error(
      `${call.provider} request failed (${response.status} ${response.statusText})${snippet ? `: ${snippet.slice(0, 200)}` : ''}`,
    );
  }
  const data = await response.json() as {
    choices?: { finish_reason?: string; message?: { content?: string; reasoning?: string } }[];
  };
  const choice = data.choices?.[0];
  const digest = choice?.message?.content?.trim();
  if (!digest) {
    const reasoningLen = (choice?.message?.reasoning ?? '').length;
    const finish = choice?.finish_reason ?? 'unknown';
    throw new Error(
      `${call.provider} returned empty content (finish=${finish}, reasoning=${reasoningLen} chars). Model may have run out of budget during thinking — raise max_tokens or trim source.`,
    );
  }
  const tokenCount = approxTokenCount(digest);
  return { digest, tokenCount };
}

const OVERSHOOT_RETRY_INSTRUCTION = `IMPORTANT RETRY: Your previous response exceeded the ${CEILING}-token hard ceiling. This time, produce a strictly shorter digest — aim for ${TARGET_MIN}-${TARGET_MAX} tokens, absolute maximum ${CEILING - 100}. Trim boilerplate, collapse similar paragraphs, drop tangential details. Quality still matters, but length compliance is non-negotiable on this retry.`;

const EXTRACTOR_RESULT_CACHE = new Map<string, string>();
let extractorStatus: 'unknown' | 'available' | 'missing' = 'unknown';

function getExtractorScriptPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return pathResolve(here, '..', 'python', 'extract.py');
}

interface ExtractionOutcome {
  text: string;
  extractorTag: string | null;
  extractorMissing: boolean;
}

async function extractFileToMarkdown(filePath: string): Promise<{ text: string; usedDocling: boolean; unsupported: boolean }> {
  const cached = EXTRACTOR_RESULT_CACHE.get(filePath);
  if (cached !== undefined) return { text: cached, usedDocling: false, unsupported: false };
  const lower = filePath.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx < 0) return { text: '', usedDocling: false, unsupported: true };
  const ext = lower.slice(dotIdx);
  const nativeExts = new Set(['.md', '.txt', '.html', '.htm']);
  const doclingExts = new Set(['.pdf', '.docx', '.pptx', '.xlsx']);
  if (nativeExts.has(ext)) {
    try {
      const text = await readFile(filePath, 'utf-8');
      EXTRACTOR_RESULT_CACHE.set(filePath, text);
      return { text, usedDocling: false, unsupported: false };
    } catch {
      return { text: '', usedDocling: false, unsupported: false };
    }
  }
  if (!doclingExts.has(ext)) {
    return { text: '', usedDocling: false, unsupported: true };
  }
  const script = getExtractorScriptPath();
  return new Promise((resolve) => {
    const proc = spawn('python3', [script, filePath]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });
    proc.on('close', (code) => {
      if (code === 0) {
        EXTRACTOR_RESULT_CACHE.set(filePath, stdout);
        extractorStatus = 'available';
        resolve({ text: stdout, usedDocling: true, unsupported: false });
      } else if (code === 2) {
        extractorStatus = 'missing';
        console.error(`  [digest] docling not installed; skipping ${filePath}`);
        resolve({ text: '', usedDocling: false, unsupported: false });
      } else {
        console.error(`  [digest] extraction failed on ${filePath} (exit ${code}): ${stderr.trim()}`);
        resolve({ text: '', usedDocling: false, unsupported: false });
      }
    });
    proc.on('error', () => {
      extractorStatus = 'missing';
      resolve({ text: '', usedDocling: false, unsupported: false });
    });
  });
}

async function extractProjectDocuments(projectDir: string): Promise<ExtractionOutcome> {
  const files = listProjectDocuments(projectDir, { depth: 1 });
  if (files.length === 0) return { text: '', extractorTag: null, extractorMissing: false };
  const pieces: string[] = [];
  let usedDocling = false;
  for (const file of files) {
    const rel = file.startsWith(projectDir + '/') ? file.slice(projectDir.length + 1) : file;
    const { text, usedDocling: wasDocling } = await extractFileToMarkdown(file);
    if (text.trim().length === 0) continue;
    pieces.push(`## ${rel}\n\n${text.trim()}\n`);
    if (wasDocling) usedDocling = true;
  }
  return {
    text: pieces.join('\n'),
    extractorTag: usedDocling ? 'docling' : null,
    extractorMissing: extractorStatus === 'missing',
  };
}

async function readSpecCascade(projectDir: string): Promise<{ text: string; source: string } | null> {
  const candidates = [
    join(projectDir, '.fctry', 'spec.md'),
    join(projectDir, 'CLAUDE.md'),
    join(projectDir, 'README.md'),
  ];
  for (const path of candidates) {
    if (await fileExists(path)) {
      const text = await readFile(path, 'utf-8');
      return { text, source: path };
    }
  }
  return null;
}

export interface RefreshResult {
  project_name: string;
  status:
    | 'refreshed'
    | 'skipped-no-source'
    | 'skipped-no-path'
    | 'skipped-not-stale'
    | 'error';
  source?: string;
  version_kind?: 'spec' | 'filetree';
  spec_version?: string;
  token_count?: number;
  producer?: string;
  prior_spec_version?: string | null;
  error?: string;
}

export async function refreshProjectDigest(registry: Registry, projectName: string, opts?: { onlyStale?: boolean }): Promise<RefreshResult> {
  const project = registry.getProject(projectName, 'full');
  if (!project) return { project_name: projectName, status: 'error', error: `Project not found: ${projectName}` };
  const paths = (project as { paths?: string[] }).paths ?? [];
  if (paths.length === 0) return { project_name: projectName, status: 'skipped-no-path' };
  const projectDir = paths[0];

  const specHit = await readSpecCascade(projectDir);
  const versionInfo = computeProjectVersion(projectDir, { depth: 1 });
  if (versionInfo.kind === 'none') {
    return { project_name: projectName, status: 'skipped-no-source' };
  }

  if (opts?.onlyStale) {
    const existing = registry.getProjectDigest(projectName);
    if (existing && existing.spec_version === versionInfo.version) {
      return {
        project_name: projectName,
        status: 'skipped-not-stale',
        version_kind: versionInfo.kind === 'spec' ? 'spec' : 'filetree',
        spec_version: versionInfo.version ?? undefined,
      };
    }
  }

  let sourceText = '';
  let sourceDescriptor = '';
  let extractorTag: string | null = null;

  if (specHit) {
    sourceText = specHit.text;
    sourceDescriptor = specHit.source;
  } else {
    const extraction = await extractProjectDocuments(projectDir);
    if (!extraction.text) {
      return { project_name: projectName, status: 'skipped-no-source' };
    }
    sourceText = extraction.text;
    sourceDescriptor = `extracted from ${projectDir}`;
    extractorTag = extraction.extractorTag;
  }

  const provider = selectProvider();
  const call = buildProviderCall(provider);

  let result: LlmResponse;
  try {
    result = await callLLM(call, sourceText, projectName);
  } catch (primaryErr) {
    // Fall back to local-mlx once if hosted path fails and we weren't already local.
    if (provider !== 'local-mlx') {
      console.error(`  [digest] ${projectName}: ${(primaryErr as Error).message}. Falling back to local-mlx.`);
      try {
        result = await callLLM(buildProviderCall('local-mlx'), sourceText, projectName);
        const producerTag = composeProducer('local-mlx', LOCAL_MODEL, extractorTag);
        return writeAndReturn(registry, projectName, result, sourceDescriptor, versionInfo, producerTag);
      } catch (fallbackErr) {
        return {
          project_name: projectName,
          status: 'error',
          source: sourceDescriptor,
          version_kind: versionInfo.kind === 'spec' ? 'spec' : 'filetree',
          spec_version: versionInfo.version ?? undefined,
          error: `${(primaryErr as Error).message}; local fallback also failed: ${(fallbackErr as Error).message}`,
        };
      }
    }
    return {
      project_name: projectName,
      status: 'error',
      source: sourceDescriptor,
      version_kind: versionInfo.kind === 'spec' ? 'spec' : 'filetree',
      spec_version: versionInfo.version ?? undefined,
      error: (primaryErr as Error).message,
    };
  }

  if (result.tokenCount > CEILING) {
    console.error(
      `  [digest] ${projectName}: first attempt overshot ceiling (${result.tokenCount} > ${CEILING}); retrying with stricter length instruction`,
    );
    try {
      result = await callLLM(call, sourceText, projectName, OVERSHOOT_RETRY_INSTRUCTION);
    } catch (retryErr) {
      return {
        project_name: projectName,
        status: 'error',
        source: sourceDescriptor,
        version_kind: versionInfo.kind === 'spec' ? 'spec' : 'filetree',
        spec_version: versionInfo.version ?? undefined,
        error: `Ceiling-overshoot retry failed: ${(retryErr as Error).message}`,
      };
    }
    if (result.tokenCount > CEILING) {
      return {
        project_name: projectName,
        status: 'error',
        source: sourceDescriptor,
        version_kind: versionInfo.kind === 'spec' ? 'spec' : 'filetree',
        spec_version: versionInfo.version ?? undefined,
        token_count: result.tokenCount,
        error: `Generated digest still exceeds ceiling after retry (${result.tokenCount} > ${CEILING} tokens).`,
      };
    }
  }

  const producerTag = composeProducer(call.provider, call.model, extractorTag);
  return writeAndReturn(registry, projectName, result, sourceDescriptor, versionInfo, producerTag);
}

function composeProducer(provider: ProviderName, model: string, extractorTag: string | null): string {
  const base = provider === 'local-mlx' ? `local-${model}` : `openrouter-${model}`;
  return extractorTag ? `${base}+${extractorTag}` : base;
}

function writeAndReturn(
  registry: Registry,
  projectName: string,
  result: LlmResponse,
  sourceDescriptor: string,
  versionInfo: { kind: 'spec' | 'filetree' | 'none'; version: string | null },
  producerTag: string,
): RefreshResult {
  const writeResult = registry.refreshProjectDigest({
    project_name: projectName,
    digest_text: result.digest,
    spec_version: versionInfo.version ?? '',
    producer: producerTag,
    token_count: result.tokenCount,
  });
  return {
    project_name: projectName,
    status: 'refreshed',
    source: sourceDescriptor,
    version_kind: versionInfo.kind === 'spec' ? 'spec' : 'filetree',
    spec_version: versionInfo.version ?? undefined,
    token_count: result.tokenCount,
    producer: producerTag,
    prior_spec_version: writeResult.prior_spec_version,
  };
}

export async function runDigestRefresh(opts: { projectName?: string; all?: boolean; stale?: boolean }): Promise<RefreshResult[]> {
  const registry = new Registry();
  const targets: string[] = [];
  if (opts.projectName) {
    targets.push(opts.projectName);
  } else if (opts.all || opts.stale) {
    const projects = registry.listProjects({ depth: 'minimal', status_filter: 'active' }) as { name: string }[];
    targets.push(...projects.map(p => p.name));
  }
  const results: RefreshResult[] = [];
  for (const name of targets) {
    const result = await refreshProjectDigest(registry, name, { onlyStale: opts.stale === true });
    results.push(result);
    formatResultLine(result);
  }
  return results;
}

function stampLabel(r: RefreshResult): string {
  if (r.version_kind === 'spec') return `spec ${r.spec_version}`;
  if (r.version_kind === 'filetree') return `fs-hash ${r.spec_version}`;
  return '';
}

function formatResultLine(r: RefreshResult): void {
  switch (r.status) {
    case 'refreshed': {
      const stamp = stampLabel(r);
      const was = r.prior_spec_version ? ` (was ${r.prior_spec_version})` : '';
      const producer = r.producer ? `, producer ${r.producer}` : '';
      console.log(`  ✓ ${r.project_name} — ${r.token_count} tokens, ${stamp}${producer}${was}`);
      break;
    }
    case 'skipped-not-stale':
      console.log(`  · ${r.project_name} — fresh (${stampLabel(r)})`);
      break;
    case 'skipped-no-path':
      console.log(`  · ${r.project_name} — no registered path, skipped`);
      break;
    case 'skipped-no-source':
      console.log(`  · ${r.project_name} — no spec.md / CLAUDE.md / README.md / supported documents, skipped`);
      break;
    case 'error':
      console.log(`  ✗ ${r.project_name} — ${r.error}`);
      break;
  }
}
