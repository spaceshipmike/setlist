// Status sets by project type
export const PROJECT_STATUSES = new Set([
  'idea', 'draft', 'active', 'paused', 'archived', 'complete',
] as const);

export const AREA_STATUSES = new Set([
  'active', 'paused',
] as const);

export const STATUS_BY_TYPE: Record<string, Set<string>> = {
  project: PROJECT_STATUSES as Set<string>,
  area_of_focus: AREA_STATUSES as Set<string>,
};

export type ProjectType = 'project' | 'area_of_focus';
export type ProjectStatus = 'idea' | 'draft' | 'active' | 'paused' | 'archived' | 'complete';
export type QueryDepth = 'minimal' | 'summary' | 'standard' | 'full';

export type MemoryType = 'decision' | 'outcome' | 'pattern' | 'preference' | 'dependency' | 'correction' | 'skill' | 'observation';
export type MemoryScope = 'project' | 'area_of_focus' | 'portfolio' | 'global';
export type MemoryStatus = 'active' | 'consolidating' | 'archived' | 'superseded';
export type MemoryEdgeType = 'updates' | 'extends' | 'derives' | 'contradicts' | 'caused_by' | 'related_to';
export type MemoryChangeType = 'created' | 'updated' | 'corrected' | 'archived' | 'superseded';
export type TaskSchedule = 'now' | 'tonight' | 'weekly';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export const MEMORY_TYPES = new Set<MemoryType>([
  'decision', 'outcome', 'pattern', 'preference', 'dependency', 'correction', 'skill', 'observation',
]);

export const MEMORY_SCOPES = new Set<MemoryScope>([
  'project', 'area_of_focus', 'portfolio', 'global',
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
  paths: string[];
  extended_fields: Record<string, string>;
  field_producers: Record<string, string>;
  capabilities: CapabilityDeclaration[];
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

export function validateStatus(projectType: string, status: string): void {
  const allowed = STATUS_BY_TYPE[projectType];
  if (!allowed) {
    throw new Error(`Unknown project type: ${projectType}. Must be 'project' or 'area_of_focus'.`);
  }
  if (!allowed.has(status)) {
    throw new Error(
      `Invalid status '${status}' for type '${projectType}'. Allowed: ${[...allowed].join(', ')}`
    );
  }
}

/** Format a ProjectRecord at summary depth — omits empty fields */
export function toSummary(record: ProjectRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: record.name,
    display_name: record.display_name,
    type: record.type,
    status: record.status,
  };
  if (record.description) result.description = record.description;
  return result;
}

/** Format a ProjectRecord at standard depth — includes template-relevant fields */
export function toStandard(record: ProjectRecord, templateFields: Set<string>): Record<string, unknown> {
  const result = toSummary(record);
  if (record.goals) result.goals = record.goals;
  if (record.paths.length > 0) result.paths = record.paths;

  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.extended_fields)) {
    if (templateFields.has(key)) {
      filtered[key] = value;
    }
  }
  if (Object.keys(filtered).length > 0) result.fields = filtered;
  return result;
}

/** Format a ProjectRecord at full depth — includes everything */
export function toFull(record: ProjectRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: record.name,
    display_name: record.display_name,
    type: record.type,
    status: record.status,
  };
  if (record.description) result.description = record.description;
  if (record.goals) result.goals = record.goals;
  if (record.paths.length > 0) result.paths = record.paths;
  if (Object.keys(record.extended_fields).length > 0) {
    result.fields = { ...record.extended_fields };
  }
  if (record.capabilities.length > 0) result.capabilities = record.capabilities;
  result.created_at = record.created_at;
  result.updated_at = record.updated_at;
  return result;
}
