// @fctry: #health-assessment
// @fctry: #auto-update
import { contextBridge, ipcRenderer } from 'electron';

// Channel name for main → renderer update event broadcasts.
const UPDATE_EVENT_CHANNEL = 'update-event';
// Spec 0.26 §S123: Cmd-, fires this from the menu accelerator.
const NAVIGATE_TO_SETTINGS_CHANNEL = 'navigate-to-settings';

const api = {
  // Project Identity
  listProjects: (opts?: { depth?: string; type_filter?: string; status_filter?: string; area_filter?: string }) =>
    ipcRenderer.invoke('listProjects', opts),
  getProject: (name: string, depth?: string) =>
    ipcRenderer.invoke('getProject', name, depth),
  searchProjects: (opts: { query: string; type_filter?: string; status_filter?: string; area_filter?: string }) =>
    ipcRenderer.invoke('searchProjects', opts),
  getRegistryStats: () =>
    ipcRenderer.invoke('getRegistryStats'),
  register: (opts: {
    name: string;
    type: string;
    status: string;
    description?: string;
    goals?: string;
    display_name?: string;
    paths?: string[];
    area?: string | null;
    parent_project?: string | null;
  }) => ipcRenderer.invoke('register', opts),
  updateCore: (name: string, updates: {
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
    area?: string | null;
    parent_project?: string | null;
  }) => ipcRenderer.invoke('updateCore', name, updates),
  updateFields: (name: string, fields: Record<string, unknown>, producer?: string) =>
    ipcRenderer.invoke('updateFields', name, fields, producer),
  archiveProject: (name: string) =>
    ipcRenderer.invoke('archiveProject', name),
  renameProject: (oldName: string, newName: string) =>
    ipcRenderer.invoke('renameProject', oldName, newName),

  // spec 0.13: areas + sub-projects
  setProjectArea: (name: string, area: string | null) =>
    ipcRenderer.invoke('setProjectArea', name, area),
  setParentProject: (childName: string, parentName: string | null) =>
    ipcRenderer.invoke('setParentProject', childName, parentName),

  // Profile
  enrichProject: (name: string, profile: {
    goals?: string[];
    topics?: string[];
    entities?: string[];
    concerns?: string[];
  }) => ipcRenderer.invoke('enrichProject', name, profile),

  // Ports
  listProjectPorts: (projectName: string) =>
    ipcRenderer.invoke('listProjectPorts', projectName),

  // Capabilities
  queryCapabilities: (opts?: { project_name?: string; capability_type?: string; keyword?: string }) =>
    ipcRenderer.invoke('queryCapabilities', opts),

  // Memory (read-only)
  recallMemories: (opts: { query?: string; project?: string; token_budget?: number }) =>
    ipcRenderer.invoke('recallMemories', opts),
  memoryStatus: (projectId?: string) =>
    ipcRenderer.invoke('memoryStatus', projectId),

  // Bootstrap
  getBootstrapConfig: () =>
    ipcRenderer.invoke('getBootstrapConfig'),
  configureBootstrap: (opts: {
    path_roots?: Record<string, string>;
    template_dir?: string;
    archive_path_root?: string;
  }) => ipcRenderer.invoke('configureBootstrap', opts),
  // Health
  assessHealth: (name?: string, opts?: { fresh?: boolean }) =>
    ipcRenderer.invoke('assessHealth', name, opts),

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
    area?: string | null;
    parent_project?: string | null;
  }) => ipcRenderer.invoke('bootstrapProject', opts),

  // Areas (spec 0.26)
  listAreas: () => ipcRenderer.invoke('areas:list'),
  createArea: (opts: { name: string; display_name?: string; description?: string; color: string }) =>
    ipcRenderer.invoke('areas:create', opts),
  updateArea: (id: number, patch: { name?: string; display_name?: string; description?: string; color?: string }) =>
    ipcRenderer.invoke('areas:update', id, patch),
  deleteArea: (id: number) => ipcRenderer.invoke('areas:delete', id),

  // Project types (spec 0.26)
  listProjectTypes: () => ipcRenderer.invoke('projectTypes:list'),
  createProjectType: (opts: {
    name: string;
    default_directory: string;
    git_init: boolean;
    template_directory?: string | null;
    color?: string | null;
  }) => ipcRenderer.invoke('projectTypes:create', opts),
  updateProjectType: (id: number, patch: {
    name?: string;
    default_directory?: string;
    git_init?: boolean;
    template_directory?: string | null;
    color?: string | null;
  }) => ipcRenderer.invoke('projectTypes:update', id, patch),
  deleteProjectType: (id: number) => ipcRenderer.invoke('projectTypes:delete', id),

  // Auto-Update (#auto-update)
  getUpdateStatus: () =>
    ipcRenderer.invoke('getUpdateStatus'),
  setUpdateChannel: (channel: 'stable' | 'beta') =>
    ipcRenderer.invoke('setUpdateChannel', channel),
  checkForUpdates: () =>
    ipcRenderer.invoke('checkForUpdates'),
  quitAndInstallUpdate: () =>
    ipcRenderer.invoke('quitAndInstallUpdate'),
  onUpdateEvent: (handler: (payload: unknown) => void) => {
    const wrapped = (_e: unknown, payload: unknown) => handler(payload);
    ipcRenderer.on(UPDATE_EVENT_CHANNEL, wrapped);
    // Return an unsubscribe fn — renderer useEffect cleanup calls it.
    return () => {
      ipcRenderer.removeListener(UPDATE_EVENT_CHANNEL, wrapped);
    };
  },

  // Spec 0.26 §S123: subscribe to navigate-to-settings (fired by the Cmd-,
  // menu accelerator). Returns an unsubscribe fn.
  onNavigateToSettings: (handler: () => void) => {
    const wrapped = () => handler();
    ipcRenderer.on(NAVIGATE_TO_SETTINGS_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(NAVIGATE_TO_SETTINGS_CHANNEL, wrapped);
    };
  },
} as const;

export type SetlistAPI = typeof api;

contextBridge.exposeInMainWorld('setlist', api);
