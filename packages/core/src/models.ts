// Status sets by project type
export const PROJECT_STATUSES = new Set([
  'idea', 'draft', 'active', 'paused', 'archived', 'complete',
] as const);

// spec 0.13: area_of_focus retired as a type; area is now a structural attribute
// (projects.area_id). area_of_focus is still accepted by validateStatus only as a
// legacy alias that maps to PROJECT_STATUSES, so historical callers fail loudly
// elsewhere (register narrows to 'project') but don't explode on status validation.
export const STATUS_BY_TYPE: Record<string, Set<string>> = {
  project: PROJECT_STATUSES as Set<string>,
};

export type ProjectType = 'project';
export type ProjectStatus = 'idea' | 'draft' | 'active' | 'paused' | 'archived' | 'complete';
export type QueryDepth = 'minimal' | 'summary' | 'standard' | 'full';

// spec 0.13: canonical seven areas. Must match db.ts CANONICAL_AREAS.
export const AREA_NAMES = [
  'Work', 'Family', 'Home', 'Health', 'Finance', 'Personal', 'Infrastructure',
] as const;
export type AreaName = (typeof AREA_NAMES)[number];
export const AREA_NAME_SET: Set<string> = new Set(AREA_NAMES);

/** Sentinel accepted by list/search filters to match area_id IS NULL. */
export const UNASSIGNED_AREA_SENTINEL = '__unassigned__';

export type MemoryType = 'decision' | 'outcome' | 'pattern' | 'preference' | 'dependency' | 'correction' | 'learning' | 'context' | 'procedural' | 'observation';
export type MemoryBelief = 'fact' | 'opinion' | 'hypothesis';
export type MemoryScope = 'project' | 'area' | 'portfolio' | 'global';
export type MemoryStatus = 'active' | 'consolidating' | 'archived' | 'superseded';
export type MemoryEdgeType = 'updates' | 'extends' | 'derives' | 'contradicts' | 'caused_by' | 'related_to';
export type MemoryChangeType = 'created' | 'updated' | 'corrected' | 'archived' | 'superseded';
export type TaskSchedule = 'now' | 'tonight' | 'weekly';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export const MEMORY_TYPES = new Set<MemoryType>([
  'decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'learning', 'context', 'procedural', 'observation',
]);

export const MEMORY_BELIEFS = new Set<MemoryBelief>(['fact', 'opinion', 'hypothesis']);

export const MEMORY_SCOPES = new Set<MemoryScope>([
  'project', 'area', 'portfolio', 'global',
]);

export interface CapabilityDeclaration {
  name: string;
  capability_type: string;
  description: string;
  inputs?: string;
  outputs?: string;
  requires_auth?: boolean | null;
  invocation_model?: string;
  audience?: string;
}

export interface ProjectRecord {
  id: number;
  name: string;
  display_name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string;
  goals: string;
  topics: string;
  entities: string;
  concerns: string;
  paths: string[];
  extended_fields: Record<string, string>;
  field_producers: Record<string, string>;
  capabilities: CapabilityDeclaration[];
  // spec 0.13: structural area + parent/children
  area: AreaName | null;
  area_id: number | null;
  parent_project: string | null;
  parent_project_id: number | null;
  parent_archived: boolean;
  children: string[];
  created_at: string;
  updated_at: string;
}

export interface PortClaim {
  port: number;
  service_label: string;
  protocol: string;
  claimed_at: string;
}

export interface Memory {
  id: string;
  content: string;
  content_l0: string | null;
  content_l1: string | null;
  type: MemoryType;
  importance: number;
  confidence: number;
  status: MemoryStatus;
  project_id: string | null;
  scope: MemoryScope;
  agent_role: string | null;
  session_id: string | null;
  tags: string | null;
  content_hash: string;
  embedding: Buffer | null;
  embedding_model: string | null;
  embedding_new: Buffer | null;
  embedding_model_new: string | null;
  reinforcement_count: number;
  outcome_score: number;
  is_static: boolean;
  is_inference: boolean;
  is_pinned: boolean;
  belief: MemoryBelief | null;
  extraction_confidence: number | null;
  valid_from: string | null;
  valid_until: string | null;
  entities: string | null;
  parent_version_id: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  last_accessed: string | null;
  forget_after: string | null;
  forget_reason: string | null;
}

export interface MemoryVersion {
  id: string;
  memory_id: string;
  previous_content: string | null;
  author: 'agent' | 'user' | 'system';
  change_type: MemoryChangeType;
  timestamp: string;
}

export interface MemoryEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: MemoryEdgeType;
  weight: number;
  confidence: number;
  observation_count: number;
  created_at: string;
}

export interface MemorySource {
  id: string;
  memory_id: string;
  project_id: string | null;
  session_id: string | null;
  agent_role: string | null;
  context_snippet: string | null;
  timestamp: string;
}

export interface SummaryBlock {
  id: string;
  scope: string;
  label: string;
  content: string;
  char_limit: number;
  tier: 'static' | 'dynamic';
  updated_at: string;
}

export interface Task {
  id: number;
  project_name: string | null;
  description: string;
  schedule: TaskSchedule;
  status: TaskStatus;
  session_reference: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export type DigestKind = 'essence';

export interface ProjectDigest {
  project_name: string;
  digest_kind: DigestKind;
  digest_text: string;
  spec_version: string;
  producer: string;
  generated_at: string;
  token_count: number | null;
  stale: boolean;
}

/** Per-digest-kind size config. Keys are DigestKind values. */
export const DIGEST_KIND_CONFIG: Record<DigestKind, { target_min: number; target_max: number; ceiling: number }> = {
  essence: { target_min: 500, target_max: 800, ceiling: 1200 },
};

export function validateStatus(projectType: string, status: string): void {
  const allowed = STATUS_BY_TYPE[projectType];
  if (!allowed) {
    throw new Error(`Unknown project type: ${projectType}. Must be 'project'.`);
  }
  if (!allowed.has(status)) {
    throw new Error(
      `Invalid status '${status}' for type '${projectType}'. Allowed: ${[...allowed].join(', ')}`
    );
  }
}

/** Format a ProjectRecord at summary depth — omits empty fields.
 * spec 0.13 § S80: area/parent_project/children are always present
 * (null/null/[]) even at summary depth — callers rely on the keys
 * being there so they can distinguish "unassigned" from "not loaded".
 */
export function toSummary(record: ProjectRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: record.name,
    display_name: record.display_name,
    type: record.type,
    status: record.status,
    updated_at: record.updated_at,
    area: record.area,
    parent_project: record.parent_project,
    children: record.children,
  };
  if (record.description) result.description = record.description;
  if (record.parent_project && record.parent_archived) result.parent_archived = true;
  return result;
}

/** Format a ProjectRecord at standard depth — includes template-relevant fields */
export function toStandard(record: ProjectRecord, templateFields: Set<string>): Record<string, unknown> {
  const result = toSummary(record);
  if (record.goals) result.goals = parseJsonArray(record.goals);
  if (record.paths.length > 0) result.paths = record.paths;

  // Profile fields
  const topics = parseJsonArray(record.topics);
  const entities = parseJsonArray(record.entities);
  const concerns = parseJsonArray(record.concerns);
  if (topics.length > 0) result.topics = topics;
  if (entities.length > 0) result.entities = entities;
  if (concerns.length > 0) result.concerns = concerns;

  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.extended_fields)) {
    if (templateFields.has(key)) {
      filtered[key] = value;
    }
  }
  if (Object.keys(filtered).length > 0) result.fields = filtered;
  return result;
}

function parseJsonArray(value: string | undefined | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  // Legacy comma-separated
  return trimmed.split(/[,\n]/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
}

/** Format a ProjectRecord at full depth — includes everything */
export function toFull(record: ProjectRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: record.name,
    display_name: record.display_name,
    type: record.type,
    status: record.status,
    area: record.area,
    parent_project: record.parent_project,
    children: record.children,
  };
  if (record.parent_project && record.parent_archived) result.parent_archived = true;
  if (record.description) result.description = record.description;
  if (record.goals) result.goals = parseJsonArray(record.goals);
  if (record.paths.length > 0) result.paths = record.paths;

  // Profile fields
  const topics = parseJsonArray(record.topics);
  const entities = parseJsonArray(record.entities);
  const concerns = parseJsonArray(record.concerns);
  if (topics.length > 0) result.topics = topics;
  if (entities.length > 0) result.entities = entities;
  if (concerns.length > 0) result.concerns = concerns;

  if (Object.keys(record.extended_fields).length > 0) {
    result.fields = { ...record.extended_fields };
  }
  if (record.capabilities.length > 0) result.capabilities = record.capabilities;
  result.created_at = record.created_at;
  result.updated_at = record.updated_at;
  return result;
}
