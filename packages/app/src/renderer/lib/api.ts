/**
 * Typed wrapper around the IPC bridge exposed via window.setlist.
 * All calls are async (IPC invoke returns promises).
 */

// Spec 0.26: areas are user-managed. The renderer treats AreaName as a free-form
// string and validates against the live `areas` table. The legacy seven-name
// constant is kept for fallback rendering during the first paint before the
// renderer has fetched the area list.
export type AreaName = string;
export const SEED_AREA_NAMES: readonly string[] = [
  'Work', 'Family', 'Home', 'Health', 'Finance', 'Personal', 'Infrastructure',
] as const;
/** @deprecated since spec 0.26 — use a live area lookup instead. */
export const AREA_NAMES = SEED_AREA_NAMES;
export const UNASSIGNED_AREA_SENTINEL = '__unassigned__';

// Spec 0.26: user-managed area row.
export interface Area {
  id: number;
  name: string;
  display_name: string;
  description: string;
  color: string;
}

// Spec 0.26: user-managed project type.
export interface ProjectTypeRow {
  id: number;
  name: string;
  default_directory: string;
  git_init: boolean;
  template_directory: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
}

/** Curated 12-color palette for areas and project types. Mirrors core/AREA_COLOR_PALETTE. */
export const AREA_COLOR_PALETTE: readonly string[] = [
  '#3b82f6', '#ec4899', '#10b981', '#ef4444', '#f59e0b', '#a855f7',
  '#6b7280', '#0ea5e9', '#14b8a6', '#f97316', '#84cc16', '#8b5cf6',
] as const;

export interface ProjectSummary {
  name: string;
  display_name: string;
  type: string;
  status: string;
  // Core's toStandard omits empty strings and returns goals as an array.
  // Always treat these as possibly missing when reading from a listing.
  description?: string;
  goals?: string[] | string;
  updated_at: string;
  created_at?: string;
  paths?: string[];
  topics?: string[];
  entities?: string[];
  concerns?: string[];
  fields?: Record<string, unknown>;
  // spec 0.13: structural area + parent/children
  area: AreaName | null;
  parent_project: string | null;
  parent_archived?: boolean;
  children: string[];
  // spec 0.26: resolved user-managed project type name + id
  project_type?: string | null;
  project_type_id?: number | null;
}

export interface ProjectFull extends ProjectSummary {
  paths: string[];
  extended_fields: Record<string, unknown>;
  capabilities: Capability[];
  ports: PortClaim[];
}

export interface Capability {
  project: string;
  name: string;
  type: string;
  description: string;
  inputs?: string;
  outputs?: string;
  requires_auth?: boolean;
}

export interface PortClaim {
  port: number;
  service_label: string;
  protocol: string;
  claimed_by: string;
  claimed_at: string;
}

export interface Memory {
  id: string;
  content: string;
  type: string;
  importance: number;
  project_id: string | null;
  scope: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RegistryStats {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  // spec 0.13: per-area distribution + unassigned count
  by_area: Record<AreaName, number>;
  unassigned: number;
}

// ── Health ────────────────────────────────────────────────────

export type HealthTier = 'healthy' | 'at_risk' | 'stale' | 'unknown';
export type HealthDimensionKey = 'activity' | 'completeness' | 'outcomes';

export interface HealthDimensionResult {
  tier: HealthTier;
  reasons: string[];
}

export interface HealthAssessment {
  name: string;
  overall: HealthTier;
  reasons: string[];
  dimensions: Record<HealthDimensionKey, HealthDimensionResult>;
  computed_at: string;
}

export interface PortfolioHealth {
  projects: HealthAssessment[];
  summary: Record<HealthTier, number>;
  computed_at: string;
}

const api = {
  listProjects: (opts?: { depth?: string; type_filter?: string; status_filter?: string; area_filter?: string }) =>
    window.setlist.listProjects(opts) as Promise<ProjectSummary[]>,

  getProject: (name: string, depth?: string) =>
    window.setlist.getProject(name, depth) as Promise<ProjectFull | null>,

  searchProjects: (opts: { query: string; type_filter?: string; status_filter?: string; area_filter?: string }) =>
    window.setlist.searchProjects(opts) as Promise<ProjectSummary[]>,

  getRegistryStats: () =>
    window.setlist.getRegistryStats() as Promise<RegistryStats>,

  register: (opts: {
    name: string;
    type: string;
    status: string;
    description?: string;
    goals?: string;
    display_name?: string;
    paths?: string[];
    area?: AreaName | null;
    parent_project?: string | null;
  }) => window.setlist.register(opts) as Promise<number>,

  updateCore: (name: string, updates: {
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
    area?: AreaName | null;
    parent_project?: string | null;
  }) => window.setlist.updateCore(name, updates),

  // spec 0.13: areas + sub-projects
  setProjectArea: (name: string, area: AreaName | null) =>
    window.setlist.setProjectArea(name, area) as Promise<ProjectFull>,
  setParentProject: (childName: string, parentName: string | null) =>
    window.setlist.setParentProject(childName, parentName) as Promise<ProjectFull>,

  updateFields: (name: string, fields: Record<string, unknown>, producer?: string) =>
    window.setlist.updateFields(name, fields, producer),

  archiveProject: (name: string) =>
    window.setlist.archiveProject(name),

  renameProject: (oldName: string, newName: string) =>
    window.setlist.renameProject(oldName, newName),

  listProjectPorts: (projectName: string) =>
    window.setlist.listProjectPorts(projectName) as Promise<PortClaim[]>,

  queryCapabilities: (opts?: { project_name?: string; capability_type?: string; keyword?: string }) =>
    window.setlist.queryCapabilities(opts) as Promise<Capability[]>,

  recallMemories: (opts: { query?: string; project?: string; token_budget?: number }) =>
    window.setlist.recallMemories(opts) as Promise<{ memories: Memory[] }>,

  memoryStatus: (projectId?: string) =>
    window.setlist.memoryStatus(projectId),

  getBootstrapConfig: () =>
    window.setlist.getBootstrapConfig() as Promise<BootstrapConfig>,

  configureBootstrap: (opts: {
    path_roots?: Record<string, string>;
    template_dir?: string;
    archive_path_root?: string;
  }) => window.setlist.configureBootstrap(opts) as Promise<BootstrapConfig>,

  bootstrapProject: (opts: {
    name: string;
    type?: string;
    project_type_id?: number;
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
    path_override?: string;
    skip_git?: boolean;
    area?: AreaName | null;
    parent_project?: string | null;
  }) => window.setlist.bootstrapProject(opts) as Promise<BootstrapResult>,

  pickDirectory: (opts?: { defaultPath?: string; title?: string }) =>
    window.setlist.pickDirectory(opts) as Promise<string | null>,

  // ── Areas (spec 0.26) ────────────────────────────────────────
  listAreas: () => window.setlist.listAreas() as Promise<Area[]>,
  createArea: (opts: { name: string; display_name?: string; description?: string; color: string }) =>
    window.setlist.createArea(opts) as Promise<Area>,
  updateArea: (id: number, patch: { name?: string; display_name?: string; description?: string; color?: string }) =>
    window.setlist.updateArea(id, patch) as Promise<Area>,
  deleteArea: (id: number) =>
    window.setlist.deleteArea(id) as Promise<{ ok: boolean }>,

  // ── Project types (spec 0.26) ────────────────────────────────
  listProjectTypes: () => window.setlist.listProjectTypes() as Promise<ProjectTypeRow[]>,
  createProjectType: (opts: {
    name: string;
    default_directory: string;
    git_init: boolean;
    template_directory?: string | null;
    color?: string | null;
  }) => window.setlist.createProjectType(opts) as Promise<ProjectTypeRow>,
  updateProjectType: (id: number, patch: {
    name?: string;
    default_directory?: string;
    git_init?: boolean;
    template_directory?: string | null;
    color?: string | null;
  }) => window.setlist.updateProjectType(id, patch) as Promise<ProjectTypeRow>,
  deleteProjectType: (id: number) =>
    window.setlist.deleteProjectType(id) as Promise<{ ok: boolean }>,

  assessHealth: (name?: string, opts?: { fresh?: boolean }) =>
    window.setlist.assessHealth(name, opts) as Promise<HealthAssessment | PortfolioHealth>,

  assessProjectHealth: (name: string, opts?: { fresh?: boolean }) =>
    window.setlist.assessHealth(name, opts) as Promise<HealthAssessment>,

  assessPortfolioHealth: (opts?: { fresh?: boolean }) =>
    window.setlist.assessHealth(undefined, opts) as Promise<PortfolioHealth>,

  // ── Auto-Update ────────────────────────────────────────────────
  getUpdateStatus: () =>
    window.setlist.getUpdateStatus() as Promise<UpdateStatus>,
  setUpdateChannel: (channel: UpdateChannel) =>
    window.setlist.setUpdateChannel(channel) as Promise<UpdateChannel>,
  checkForUpdates: () =>
    window.setlist.checkForUpdates() as Promise<{ initiated?: boolean; dev_skip?: boolean }>,
  quitAndInstallUpdate: () =>
    window.setlist.quitAndInstallUpdate() as Promise<boolean>,
  onUpdateEvent: (handler: (payload: UpdateEventPayload) => void) =>
    window.setlist.onUpdateEvent(handler as (p: unknown) => void) as () => void,
};

export type UpdateChannel = 'stable' | 'beta';
export type UpdateOutcome =
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface LastCheck {
  timestamp: string;
  outcome: UpdateOutcome;
  message?: string;
  version?: string;
}

export interface UpdateStatus {
  channel: UpdateChannel;
  version: string;
  last_check: LastCheck | null;
  in_flight: boolean;
  downloaded: boolean;
  downloaded_version: string | null;
  dev_mode: boolean;
}

export interface UpdateEventPayload {
  outcome: UpdateOutcome;
  version?: string;
  message?: string;
  timestamp: string;
}

export interface BootstrapConfig {
  path_roots: Record<string, string>;
  template_dir?: string;
  archive_path_root?: string;
}

export interface BootstrapResult {
  name: string;
  path: string;
  type: string;
  git_initialized: boolean;
  templates_applied: boolean;
  parent_gitignore_updated: boolean;
}

export default api;
