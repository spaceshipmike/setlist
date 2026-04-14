// @fctry: #health-assessment
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Project Identity
  listProjects: (opts?: { depth?: string; type_filter?: string; status_filter?: string }) =>
    ipcRenderer.invoke('listProjects', opts),
  getProject: (name: string, depth?: string) =>
    ipcRenderer.invoke('getProject', name, depth),
  searchProjects: (opts: { query: string; type_filter?: string; status_filter?: string }) =>
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
  }) => ipcRenderer.invoke('register', opts),
  updateCore: (name: string, updates: {
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
  }) => ipcRenderer.invoke('updateCore', name, updates),
  updateFields: (name: string, fields: Record<string, unknown>, producer?: string) =>
    ipcRenderer.invoke('updateFields', name, fields, producer),
  archiveProject: (name: string) =>
    ipcRenderer.invoke('archiveProject', name),
  renameProject: (oldName: string, newName: string) =>
    ipcRenderer.invoke('renameProject', oldName, newName),

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
    type: string;
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
    path_override?: string;
    skip_git?: boolean;
  }) => ipcRenderer.invoke('bootstrapProject', opts),
} as const;

export type SetlistAPI = typeof api;

contextBridge.exposeInMainWorld('setlist', api);
