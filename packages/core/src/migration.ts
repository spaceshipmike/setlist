import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { parse as yamlParse } from './yaml-parse.js';
import { Registry } from './registry.js';
import { discoverPortsInPath } from './port-discovery.js';

const SKIP_DIRS = new Set(['.DS_Store', '.git', '__pycache__', 'node_modules', 'resources']);

export interface MigrationProposal {
  name: string;
  project_type: 'project' | 'area_of_focus';
  status: string;
  description: string;
  goals: string;
  paths: string[];
  display_name: string;
  extended_fields: Record<string, unknown>;
  source: 'fctry-synopsis' | 'fctry-frontmatter' | 'brief' | 'directory';
  producer: string;
}

const STATUS_NORMALIZE: Record<string, string> = {
  active: 'active',
  building: 'active',
  draft: 'draft',
  idea: 'idea',
  paused: 'paused',
  archived: 'archived',
  complete: 'complete',
  completed: 'complete',
  stable: 'active',
};

function humanizeDirName(name: string): string {
  return name.replace(/-/g, ' ').replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function sourceRichness(source: string): number {
  return { 'fctry-synopsis': 4, 'fctry-frontmatter': 3, brief: 2, directory: 1 }[source] ?? 0;
}

function extractLeadParagraph(text: string): string {
  const lines = text.split('\n');
  const paragraphLines: string[] = [];
  let foundContent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (foundContent) break;
      continue;
    }
    if (trimmed.startsWith('#')) continue;
    if (trimmed === '---') {
      if (foundContent) break;
      continue;
    }
    if (trimmed.startsWith('```')) continue;
    foundContent = true;
    paragraphLines.push(trimmed);
  }

  return paragraphLines.join(' ');
}

function extractFromFctrySpec(specPath: string, projectDir: string): MigrationProposal | null {
  let content: string;
  try {
    content = readFileSync(specPath, 'utf-8');
  } catch {
    return null;
  }

  // Parse frontmatter — code-fenced YAML or bare frontmatter
  let yamlText: string | null = null;

  // Format 1: code-fenced YAML
  const fenceMatch = content.match(/```ya?ml\s*\n---\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    yamlText = fenceMatch[1].replace(/^---\s*$/gm, '');
  }

  // Format 2: bare frontmatter
  if (!yamlText) {
    const bareMatch = content.match(/^---\s*\n([\s\S]*?)---\s*\n/);
    if (bareMatch) {
      yamlText = bareMatch[1];
    }
  }

  if (!yamlText) return null;

  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = yamlParse(yamlText);
  } catch {
    return null;
  }

  const dirName = basename(projectDir);
  const title = (frontmatter.title as string) ?? dirName;
  const rawStatus = ((frontmatter.status as string) ?? 'active').toLowerCase();
  const status = STATUS_NORMALIZE[rawStatus] ?? 'active';
  const synopsis = (frontmatter.synopsis as Record<string, unknown>) ?? {};

  let description = '';
  let goals = '';
  const extendedFields: Record<string, unknown> = {};
  let source: 'fctry-synopsis' | 'fctry-frontmatter' = 'fctry-frontmatter';

  if (Object.keys(synopsis).length > 0) {
    source = 'fctry-synopsis';
    description = (synopsis.medium as string) ?? (synopsis.short as string) ?? '';

    if (synopsis.short) extendedFields.short_description = synopsis.short;
    if (synopsis.medium) extendedFields.medium_description = synopsis.medium;
    if (synopsis.readme) extendedFields.readme_description = synopsis.readme;

    const techStack = (synopsis['tech-stack'] ?? synopsis.tech_stack) as string[] | undefined;
    if (techStack && Array.isArray(techStack)) {
      extendedFields.tech_stack = techStack;
    }

    const patterns = synopsis.patterns as string[] | undefined;
    if (patterns && Array.isArray(patterns)) {
      extendedFields.patterns = patterns;
    }

    const goalsList = synopsis.goals as string[] | undefined;
    if (goalsList && Array.isArray(goalsList)) {
      goals = goalsList.map(g => `- ${g}`).join('\n');
    }
  } else {
    // Bare frontmatter — extract first paragraph
    description = extractLeadParagraph(content);
  }

  return {
    name: dirName,
    project_type: 'project',
    status,
    description,
    goals,
    paths: [projectDir],
    display_name: title === dirName ? humanizeDirName(dirName) : title,
    extended_fields: extendedFields,
    source,
    producer: 'migration',
  };
}

function extractFromBrief(briefPath: string, projectDir: string): MigrationProposal | null {
  try {
    const content = readFileSync(briefPath, 'utf-8');
    const description = extractLeadParagraph(content);
    const dirName = basename(projectDir);

    return {
      name: dirName,
      project_type: 'project',
      status: 'active',
      description,
      goals: '',
      paths: [projectDir],
      display_name: humanizeDirName(dirName),
      extended_fields: {},
      source: 'brief',
      producer: 'migration',
    };
  } catch {
    return null;
  }
}

function extractCodeProject(projectDir: string): MigrationProposal {
  // Try fctry spec first
  const specPath = join(projectDir, '.fctry', 'spec.md');
  if (existsSync(specPath)) {
    const proposal = extractFromFctrySpec(specPath, projectDir);
    if (proposal) return proposal;
  }

  // Directory fallback
  const dirName = basename(projectDir);
  return {
    name: dirName,
    project_type: 'project',
    status: 'active',
    description: '',
    goals: '',
    paths: [projectDir],
    display_name: humanizeDirName(dirName),
    extended_fields: {},
    source: 'directory',
    producer: 'migration',
  };
}

function extractNonCodeProject(projectDir: string): MigrationProposal {
  // Try fctry spec in _Project/ thinking surface
  const thinkingSpec = join(projectDir, '_Project', '.fctry', 'spec.md');
  if (existsSync(thinkingSpec)) {
    const proposal = extractFromFctrySpec(thinkingSpec, projectDir);
    if (proposal) {
      proposal.project_type = 'area_of_focus';
      return proposal;
    }
  }

  // Try brief.md
  const briefPath = join(projectDir, 'brief.md');
  if (existsSync(briefPath)) {
    const proposal = extractFromBrief(briefPath, projectDir);
    if (proposal) {
      proposal.project_type = 'area_of_focus';
      return proposal;
    }
  }

  // Directory fallback
  const dirName = basename(projectDir);
  return {
    name: dirName,
    project_type: 'area_of_focus',
    status: 'active',
    description: '',
    goals: '',
    paths: [projectDir],
    display_name: humanizeDirName(dirName),
    extended_fields: {},
    source: 'directory',
    producer: 'migration',
  };
}

function listSubdirectories(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter(name => !SKIP_DIRS.has(name) && !name.startsWith('.'))
      .map(name => join(dir, name))
      .filter(path => { try { return statSync(path).isDirectory(); } catch { return false; } })
      .sort();
  } catch {
    return [];
  }
}

export function scanLocations(opts?: {
  codeDir?: string;
  projectsDir?: string;
}): MigrationProposal[] {
  const codeDir = opts?.codeDir ?? join(homedir(), 'Code');
  const projectsDir = opts?.projectsDir ?? join(homedir(), 'Projects');

  const proposalMap = new Map<string, MigrationProposal>();

  // Scan code projects
  for (const dir of listSubdirectories(codeDir)) {
    const proposal = extractCodeProject(dir);
    const existing = proposalMap.get(proposal.name);
    if (existing) {
      // Merge: keep richer source, add path
      if (sourceRichness(proposal.source) > sourceRichness(existing.source)) {
        proposal.paths = [...new Set([...existing.paths, ...proposal.paths])];
        proposalMap.set(proposal.name, proposal);
      } else {
        existing.paths = [...new Set([...existing.paths, ...proposal.paths])];
      }
    } else {
      proposalMap.set(proposal.name, proposal);
    }
  }

  // Scan non-code projects
  for (const dir of listSubdirectories(projectsDir)) {
    const proposal = extractNonCodeProject(dir);
    const existing = proposalMap.get(proposal.name);
    if (existing) {
      if (sourceRichness(proposal.source) > sourceRichness(existing.source)) {
        proposal.paths = [...new Set([...existing.paths, ...proposal.paths])];
        proposalMap.set(proposal.name, proposal);
      } else {
        existing.paths = [...new Set([...existing.paths, ...proposal.paths])];
      }
    } else {
      proposalMap.set(proposal.name, proposal);
    }
  }

  return [...proposalMap.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function applyProposals(
  proposals: MigrationProposal[],
  dbPath?: string,
  discoverPorts: boolean = true,
): { registered: number; skipped: number; ports_claimed: number } {
  const registry = new Registry(dbPath);
  let registered = 0;
  let skipped = 0;
  let portsClaimed = 0;

  for (const proposal of proposals) {
    try {
      registry.register({
        name: proposal.name,
        type: proposal.project_type,
        status: proposal.status,
        description: proposal.description,
        goals: proposal.goals,
        display_name: proposal.display_name,
        paths: proposal.paths,
        fields: Object.keys(proposal.extended_fields).length > 0 ? proposal.extended_fields : undefined,
        producer: proposal.producer,
      });
      registered++;

      if (discoverPorts && proposal.paths.length > 0) {
        try {
          const result = registry.discoverPorts(proposal.name);
          portsClaimed += result.claimed.length;
        } catch {
          // Port discovery failures don't block migration
        }
      }
    } catch {
      skipped++;
    }
  }

  return { registered, skipped, ports_claimed: portsClaimed };
}
