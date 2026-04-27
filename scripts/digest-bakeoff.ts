#!/usr/bin/env npx tsx
/**
 * digest-bakeoff.ts — One-off bake-off for setlist's digest model selection.
 *
 * Why: GLM-4.7-flash was promoted as the digest default based on a single
 * lucky sample (the "Milkdown" canary appeared in run #1, didn't in run #2).
 * This bake-off applies the methodology revision (N≥3 per model, lesson from
 * the orchestrator extraction work) to the actual setlist surface.
 *
 * What it does:
 *   - Reads fixtures from scripts/digest-bakeoff-fixtures.json
 *   - For each (project, config, sample), calls OpenRouter with the same
 *     SYSTEM_PROMPT setlist's digest.ts uses
 *   - Scores feature recall: case-insensitive substring match against the
 *     hand-labeled features in the fixture
 *   - Aggregates: per-(project, config) mean and stdev recall, per-config
 *     overall recall, length compliance against the 500–800 token target
 *   - Writes per-cell JSON to scripts/digest-bakeoff-runs/
 *   - Writes summary to scripts/digest-bakeoff-results.md
 *
 * Cost: ~$1–3 for 48 calls (4 projects × 4 configs × 3 samples).
 *
 * Usage:
 *   ./scripts/digest-bakeoff.ts                # full run
 *   ./scripts/digest-bakeoff.ts --resume       # skip cells whose JSON exists
 *   ./scripts/digest-bakeoff.ts --dry-run      # print plan, no calls
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_PATH = join(ROOT, 'scripts', 'digest-bakeoff-fixtures.json');
const RUNS_DIR = join(ROOT, 'scripts', 'digest-bakeoff-runs');
const REPORT_PATH = join(ROOT, 'scripts', 'digest-bakeoff-results.md');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const TARGET_MIN = 500;
const TARGET_MAX = 800;
const CEILING = 1200;

// Lifted verbatim from packages/cli/src/digest.ts so the bake-off measures
// what production measures.
const SYSTEM_PROMPT = `You produce project essence summaries for the setlist project registry.

Your job: read a project's fctry spec (or CLAUDE.md / README.md fallback, or concatenated markdown extracted from the project's documents) and write a dense, factual summary of what the project is today. The summary is stored as a free-form text blob and used for embedding, semantic matching against external references, and drop-in context for cross-project questions.

Content requirements:
- **Target ${TARGET_MIN}–${TARGET_MAX} tokens.** Hard ceiling ${CEILING}. Stay inside the target range. If you need to trim, drop boilerplate first.
- **Describe current state only.** Omit historical context, port origins, retired peer implementations, and claims about deprecated or archived components unless they constrain current behavior. If the source contains port-era framing or "originally a port of X" language, reflect what the project *is today*, not what it *came from*.
- **Factual and dense; no marketing voice.** Strip phrases like "at the center of the user's personal ecosystem," "directly operable," "invisible infrastructure." Claims must be concrete and capability-specific.
- **Name unbuilt sections explicitly.** The digest is used to match external references against projects that could benefit from them; references are most valuable for unbuilt work, so call out what's specced-but-not-built, what's in progress, and what's explicitly deferred.
- **Structure: multiple paragraphs, one per major surface area, separated by blank lines.** Do NOT emit a single mega-paragraph. Do NOT use bullet lists. Do NOT use section headers. No markdown.
- **Do not invent facts.** If the source doesn't name something, don't name it. If you're uncertain whether a capability is current or historical, omit it.

Respond with only the digest text. Do not preface it, do not label it, do not wrap it in code fences or quotes.`;

interface Fixture {
  project: string;
  source_path: string;
  features: string[];
}

interface FixturesFile {
  fixtures: Fixture[];
}

interface ModelConfig {
  label: string;
  model: string;
  temperature: number;
  is_current_prod: boolean;
}

const CONFIGS: ModelConfig[] = [
  { label: 'glm-4.7-flash@t0.2', model: 'z-ai/glm-4.7-flash',           temperature: 0.2, is_current_prod: true  },
  { label: 'glm-4.7-flash@t0.0', model: 'z-ai/glm-4.7-flash',           temperature: 0.0, is_current_prod: false },
  { label: 'flash-lite@t0.0',    model: 'google/gemini-2.5-flash-lite', temperature: 0.0, is_current_prod: false },
  { label: 'flash@t0.0',         model: 'google/gemini-2.5-flash',      temperature: 0.0, is_current_prod: false },
];

const SAMPLES = [1, 2, 3];

const argDryRun = process.argv.includes('--dry-run');
const argResume = process.argv.includes('--resume');

interface CellResult {
  project: string;
  config_label: string;
  model: string;
  temperature: number;
  sample: number;
  digest: string;
  token_count: number;
  matched_features: string[];
  missing_features: string[];
  recall: number;          // 0–1
  length_compliance: 'under' | 'in_range' | 'over_target' | 'over_ceiling';
  duration_ms: number;
  cost_usd: number | null; // OpenRouter doesn't return per-call cost in headers; left null for now
  error: string | null;
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function loadFixtures(): Promise<Fixture[]> {
  const raw = await readFile(FIXTURES_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as FixturesFile;
  return parsed.fixtures;
}

async function loadSource(fixture: Fixture): Promise<string> {
  return readFile(fixture.source_path, 'utf-8');
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function classifyLength(tokens: number): CellResult['length_compliance'] {
  if (tokens < TARGET_MIN) return 'under';
  if (tokens <= TARGET_MAX) return 'in_range';
  if (tokens <= CEILING) return 'over_target';
  return 'over_ceiling';
}

function scoreRecall(digest: string, features: string[]): { matched: string[]; missing: string[]; recall: number } {
  const lower = digest.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const f of features) {
    if (lower.includes(f.toLowerCase())) matched.push(f);
    else missing.push(f);
  }
  const recall = features.length === 0 ? 0 : matched.length / features.length;
  return { matched, missing, recall };
}

async function callModel(config: ModelConfig, projectName: string, sourceText: string): Promise<{ digest: string; tokens: number }> {
  const apiKey = process.env.SETLIST_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey) throw new Error('SETLIST_OPENROUTER_API_KEY (or OPENROUTER_API_KEY) is not set');

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Project: ${projectName}\n\nSource:\n\n${sourceText}` },
    ],
    temperature: config.temperature,
    max_tokens: 6000,
  };

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/mikelebowitz/setlist',
      'X-Title': 'setlist-digest-bakeoff',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const snippet = await response.text().catch(() => '');
    throw new Error(`${config.label} request failed (${response.status}): ${snippet.slice(0, 300)}`);
  }
  const data = await response.json() as {
    choices?: { finish_reason?: string; message?: { content?: string; reasoning?: string } }[];
  };
  const choice = data.choices?.[0];
  const digest = choice?.message?.content?.trim();
  if (!digest) {
    const reasoningLen = (choice?.message?.reasoning ?? '').length;
    const finish = choice?.finish_reason ?? 'unknown';
    throw new Error(`${config.label} returned empty content (finish=${finish}, reasoning=${reasoningLen} chars)`);
  }
  return { digest, tokens: approxTokens(digest) };
}

async function runCell(fixture: Fixture, config: ModelConfig, sample: number, sourceText: string): Promise<CellResult> {
  const cellPath = join(RUNS_DIR, fixture.project, config.label, `s${sample}.json`);
  if (argResume && (await fileExists(cellPath))) {
    const raw = await readFile(cellPath, 'utf-8');
    return JSON.parse(raw) as CellResult;
  }

  const startedAt = Date.now();
  let result: CellResult;
  try {
    const { digest, tokens } = await callModel(config, fixture.project, sourceText);
    const { matched, missing, recall } = scoreRecall(digest, fixture.features);
    result = {
      project: fixture.project,
      config_label: config.label,
      model: config.model,
      temperature: config.temperature,
      sample,
      digest,
      token_count: tokens,
      matched_features: matched,
      missing_features: missing,
      recall,
      length_compliance: classifyLength(tokens),
      duration_ms: Date.now() - startedAt,
      cost_usd: null,
      error: null,
    };
  } catch (err) {
    result = {
      project: fixture.project,
      config_label: config.label,
      model: config.model,
      temperature: config.temperature,
      sample,
      digest: '',
      token_count: 0,
      matched_features: [],
      missing_features: fixture.features,
      recall: 0,
      length_compliance: 'under',
      duration_ms: Date.now() - startedAt,
      cost_usd: null,
      error: (err as Error).message,
    };
  }

  await mkdir(dirname(cellPath), { recursive: true });
  await writeFile(cellPath, JSON.stringify(result, null, 2));
  return result;
}

interface Summary {
  by_project_config: Map<string, CellResult[]>; // key: `${project}::${config_label}`
  by_config: Map<string, CellResult[]>;          // key: config_label
  all: CellResult[];
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function buildReport(summary: Summary, fixtures: Fixture[]): string {
  const lines: string[] = [];
  lines.push('# Setlist Digest Model Bake-Off');
  lines.push('');
  lines.push(`**Run:** ${new Date().toISOString()}`);
  lines.push(`**Method:** N=${SAMPLES.length} samples per (project × config). Recall = % of hand-labeled named features mentioned in the digest (case-insensitive substring match). Length is approximate token count vs the 500–800 target / 1200 ceiling defined in setlist's digest.ts.`);
  lines.push('');
  lines.push(`**Fixtures:** ${fixtures.map(f => `${f.project} (${f.features.length} features)`).join(', ')}`);
  lines.push('');
  lines.push('## Per-Config Aggregate');
  lines.push('');
  lines.push('| config | recall μ | recall σ | length compliance | errors |');
  lines.push('|---|---|---|---|---|');
  for (const config of CONFIGS) {
    const cells = summary.by_config.get(config.label) ?? [];
    const recalls = cells.map(c => c.recall);
    const inRange = cells.filter(c => c.length_compliance === 'in_range').length;
    const errors = cells.filter(c => c.error).length;
    const flag = config.is_current_prod ? ' (current prod)' : '';
    lines.push(`| ${config.label}${flag} | ${formatPct(mean(recalls))} | ${(stdev(recalls) * 100).toFixed(1)}pp | ${inRange}/${cells.length} | ${errors} |`);
  }
  lines.push('');

  lines.push('## Per-Project × Config');
  lines.push('');
  lines.push('Each cell shows mean recall (σ across 3 samples) and length range.');
  lines.push('');
  // Header
  const headerCells = ['project', ...CONFIGS.map(c => c.label)];
  lines.push(`| ${headerCells.join(' | ')} |`);
  lines.push(`|${headerCells.map(() => '---').join('|')}|`);
  for (const fixture of fixtures) {
    const row: string[] = [fixture.project];
    for (const config of CONFIGS) {
      const key = `${fixture.project}::${config.label}`;
      const cells = summary.by_project_config.get(key) ?? [];
      const recalls = cells.map(c => c.recall);
      const tokens = cells.map(c => c.token_count);
      const errored = cells.filter(c => c.error).length;
      if (errored > 0 && recalls.every(r => r === 0)) {
        row.push(`ERR ×${errored}`);
        continue;
      }
      const meanR = formatPct(mean(recalls));
      const stdR = `${(stdev(recalls) * 100).toFixed(1)}pp`;
      const tokRange = tokens.length > 0 ? `${Math.min(...tokens)}–${Math.max(...tokens)}t` : '—';
      row.push(`${meanR} (σ${stdR}) ${tokRange}`);
    }
    lines.push(`| ${row.join(' | ')} |`);
  }
  lines.push('');

  lines.push('## Per-Project Feature-Level Recall (best to worst per project)');
  lines.push('');
  for (const fixture of fixtures) {
    lines.push(`### ${fixture.project}`);
    lines.push('');
    lines.push('| feature | ' + CONFIGS.map(c => c.label).join(' | ') + ' |');
    lines.push('|---|' + CONFIGS.map(() => '---').join('|') + '|');
    for (const feature of fixture.features) {
      const row: string[] = [`\`${feature}\``];
      for (const config of CONFIGS) {
        const key = `${fixture.project}::${config.label}`;
        const cells = summary.by_project_config.get(key) ?? [];
        const hits = cells.filter(c => c.matched_features.includes(feature)).length;
        row.push(`${hits}/${cells.length}`);
      }
      lines.push(`| ${row.join(' | ')} |`);
    }
    lines.push('');
  }

  lines.push('## Errors');
  lines.push('');
  const errored = summary.all.filter(c => c.error);
  if (errored.length === 0) {
    lines.push('None.');
  } else {
    for (const c of errored) {
      lines.push(`- ${c.project} / ${c.config_label} / s${c.sample}: ${c.error}`);
    }
  }
  lines.push('');

  lines.push('## Recommendation');
  lines.push('');
  lines.push('_Fill in after reviewing the numbers above._');
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const fixtures = await loadFixtures();
  const total = fixtures.length * CONFIGS.length * SAMPLES.length;

  console.log(`digest-bakeoff: ${fixtures.length} projects × ${CONFIGS.length} configs × ${SAMPLES.length} samples = ${total} cells`);
  console.log(`projects: ${fixtures.map(f => f.project).join(', ')}`);
  console.log(`configs: ${CONFIGS.map(c => c.label).join(', ')}`);
  if (argDryRun) { console.log('--dry-run; exiting'); return; }
  if (argResume) console.log('--resume: existing cell JSONs will be reused');

  const sourcesByProject = new Map<string, string>();
  for (const f of fixtures) sourcesByProject.set(f.project, await loadSource(f));

  const all: CellResult[] = [];
  let n = 0;
  for (const config of CONFIGS) {
    for (const sample of SAMPLES) {
      for (const fixture of fixtures) {
        n++;
        const tag = `[${n}/${total}] ${fixture.project} / ${config.label} / s${sample}`;
        process.stdout.write(`${tag} ... `);
        const result = await runCell(fixture, config, sample, sourcesByProject.get(fixture.project)!);
        all.push(result);
        if (result.error) {
          process.stdout.write(`ERR (${result.error.slice(0, 80)})\n`);
        } else {
          process.stdout.write(`recall=${formatPct(result.recall)} tokens=${result.token_count} ${result.length_compliance} (${(result.duration_ms / 1000).toFixed(1)}s)\n`);
        }
      }
    }
  }

  const byPC = new Map<string, CellResult[]>();
  const byC = new Map<string, CellResult[]>();
  for (const r of all) {
    const pcKey = `${r.project}::${r.config_label}`;
    if (!byPC.has(pcKey)) byPC.set(pcKey, []);
    byPC.get(pcKey)!.push(r);
    if (!byC.has(r.config_label)) byC.set(r.config_label, []);
    byC.get(r.config_label)!.push(r);
  }
  const summary: Summary = { by_project_config: byPC, by_config: byC, all };

  const report = buildReport(summary, fixtures);
  await writeFile(REPORT_PATH, report);

  console.log('');
  console.log(`report → ${REPORT_PATH}`);
  console.log('');
  console.log('Per-config recall summary:');
  for (const config of CONFIGS) {
    const cells = byC.get(config.label) ?? [];
    const recalls = cells.map(c => c.recall);
    const errs = cells.filter(c => c.error).length;
    const flag = config.is_current_prod ? ' [PROD]' : '';
    console.log(`  ${config.label.padEnd(22)}${flag.padEnd(8)} recall μ=${formatPct(mean(recalls))} σ=${(stdev(recalls) * 100).toFixed(1)}pp errors=${errs}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
