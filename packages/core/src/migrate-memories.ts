import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { MemoryStore } from './memory.js';

const CC_PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const FCTRY_MEMORY = join(homedir(), '.fctry', 'memory.md');

/** Map CC memory types → registry memory types */
const CC_TYPE_MAP: Record<string, string> = {
  feedback: 'preference',
  project: 'decision',
  user: 'preference',
  reference: 'dependency',
};

export interface MemoryMigrationProposal {
  content: string;
  type: string;
  project_id: string | null;
  scope: string;
  source: string;
  tags: string[];
}

export interface MemoryMigrationResult {
  migrated: number;
  skipped: number;
  proposals: MemoryMigrationProposal[];
}

function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = val;
    }
  }
  return { meta, body: match[2].trim() };
}

function deriveProjectSlug(dirName: string): string | null {
  // Encoded path format: -Users-username-Code-project-name
  const parts = dirName.split('-');
  // Find "Code" or "Projects" marker and take what follows
  const codeIdx = parts.indexOf('Code');
  if (codeIdx >= 0 && codeIdx + 1 < parts.length) {
    return parts.slice(codeIdx + 1).join('-');
  }
  const projIdx = parts.indexOf('Projects');
  if (projIdx >= 0 && projIdx + 1 < parts.length) {
    return parts.slice(projIdx + 1).join('-');
  }
  return null;
}

/** Collect CC auto-memory files from ~/.claude/projects/{project}/memory/{file}.md */
function collectCcMemories(): MemoryMigrationProposal[] {
  const proposals: MemoryMigrationProposal[] = [];
  if (!existsSync(CC_PROJECTS_DIR)) return proposals;

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(CC_PROJECTS_DIR);
  } catch {
    return proposals;
  }

  for (const dirName of projectDirs) {
    const memoryDir = join(CC_PROJECTS_DIR, dirName, 'memory');
    if (!existsSync(memoryDir)) continue;

    const slug = deriveProjectSlug(dirName);

    let files: string[];
    try {
      files = readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    } catch {
      continue;
    }

    for (const file of files) {
      try {
        const content = readFileSync(join(memoryDir, file), 'utf-8');
        const { meta, body } = parseFrontmatter(content);
        if (!body.trim()) continue;

        const ccType = meta.type ?? basename(file, '.md');
        const registryType = CC_TYPE_MAP[ccType] ?? 'pattern';

        proposals.push({
          content: body,
          type: registryType,
          project_id: slug,
          scope: slug ? 'project' : 'global',
          source: `cc-memory:${dirName}/${file}`,
          tags: ['migrated', 'cc-auto-memory', ccType],
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return proposals;
}

/** Collect fctry global memory from ~/.fctry/memory.md */
function collectFctryMemory(): MemoryMigrationProposal[] {
  const proposals: MemoryMigrationProposal[] = [];
  if (!existsSync(FCTRY_MEMORY)) return proposals;

  try {
    const content = readFileSync(FCTRY_MEMORY, 'utf-8');
    // Split on ## headings — each section is a separate digest entry
    const sections = content.split(/^## /m).filter(s => s.trim());

    for (const section of sections) {
      const firstLine = section.split('\n')[0].trim();
      const body = section.trim();
      if (!body) continue;

      // Try to extract project name from the heading
      const projectMatch = firstLine.match(/\b(fctry|chorus|archibald|ctx|knowmarks|setlist|mcpoyle)\b/i);
      const projectId = projectMatch ? projectMatch[1].toLowerCase() : null;

      proposals.push({
        content: body,
        type: 'decision',
        project_id: projectId,
        scope: projectId ? 'project' : 'portfolio',
        source: 'fctry-memory',
        tags: ['migrated', 'fctry-memory'],
      });
    }
  } catch {
    // Skip unreadable file
  }

  return proposals;
}

/** Scan all memory sources and return migration proposals */
export function scanMemories(): MemoryMigrationProposal[] {
  return [...collectCcMemories(), ...collectFctryMemory()];
}

/** Apply migration proposals to the memory store */
export function applyMemoryMigration(
  proposals: MemoryMigrationProposal[],
  dbPath?: string,
): MemoryMigrationResult {
  const store = new MemoryStore(dbPath);
  let migrated = 0;
  let skipped = 0;

  for (const proposal of proposals) {
    try {
      const result = store.retain({
        content: proposal.content,
        type: proposal.type,
        project_id: proposal.project_id,
        scope: proposal.scope,
        tags: proposal.tags,
        agent_role: 'migration',
      });
      if (result.is_new) {
        migrated++;
      } else {
        skipped++; // Dedup hit — already exists
      }
    } catch {
      skipped++;
    }
  }

  return { migrated, skipped, proposals };
}
