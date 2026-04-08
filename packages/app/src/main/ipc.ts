import type { IpcMain } from 'electron';
import { Registry, MemoryStore, MemoryRetrieval, Bootstrap } from '@setlist/core';

let registry: Registry | null = null;

function getRegistry(): Registry {
  if (!registry) registry = new Registry();
  return registry;
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  const reg = getRegistry();

  // ── Project Identity ──────────────────────────────────────────

  ipcMain.handle('listProjects', (_e, opts?: {
    depth?: string;
    type_filter?: string;
    status_filter?: string;
  }) => {
    return reg.listProjects(opts as Parameters<Registry['listProjects']>[0]);
  });

  ipcMain.handle('getProject', (_e, name: string, depth?: string) => {
    return reg.getProject(name, depth as 'summary' | 'standard' | 'full');
  });

  ipcMain.handle('searchProjects', (_e, opts: {
    query: string;
    type_filter?: string;
    status_filter?: string;
  }) => {
    return reg.searchProjects(opts);
  });

  ipcMain.handle('getRegistryStats', () => {
    return reg.getRegistryStats();
  });

  ipcMain.handle('register', (_e, opts: Parameters<Registry['register']>[0]) => {
    return reg.register(opts);
  });

  ipcMain.handle('updateCore', (_e, name: string, updates: Parameters<Registry['updateCore']>[1]) => {
    reg.updateCore(name, updates);
    return reg.getProject(name, 'standard');
  });

  ipcMain.handle('updateFields', (_e, name: string, fields: Record<string, unknown>, producer?: string) => {
    reg.updateFields(name, fields, producer ?? 'setlist-app');
  });

  ipcMain.handle('archiveProject', (_e, name: string) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.archiveProject(name);
  });

  ipcMain.handle('renameProject', (_e, oldName: string, newName: string) => {
    reg.renameProject(oldName, newName);
  });

  // ── Profile Enrichment ────────────────────────────────────────

  ipcMain.handle('enrichProject', (_e, name: string, profile: {
    goals?: string[];
    topics?: string[];
    entities?: string[];
    concerns?: string[];
  }) => {
    return reg.enrichProject(name, profile);
  });

  // ── Ports ────────────────────────────────────────────────────

  ipcMain.handle('listProjectPorts', (_e, projectName: string) => {
    return reg.listProjectPorts(projectName);
  });

  // ── Capabilities ─────────────────────────────────────────────

  ipcMain.handle('queryCapabilities', (_e, opts?: {
    project_name?: string;
    capability_type?: string;
    keyword?: string;
  }) => {
    return reg.queryCapabilities(opts);
  });

  // ── Memory (read-only for v1) ────────────────────────────────

  ipcMain.handle('recallMemories', (_e, opts: {
    query?: string;
    project?: string;
    token_budget?: number;
  }) => {
    const retrieval = new MemoryRetrieval(reg.dbPath);
    return retrieval.recall({
      query: opts.query,
      project: opts.project,
      token_budget: opts.token_budget ?? 4000,
    });
  });

  ipcMain.handle('memoryStatus', (_e, projectId?: string) => {
    const store = new MemoryStore(reg.dbPath);
    return store.memoryStatus(projectId);
  });

  // ── Bootstrap ─────────────────────────────────────────────────

  ipcMain.handle('getBootstrapConfig', () => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.getConfig();
  });

  ipcMain.handle('configureBootstrap', (_e, opts: {
    path_roots?: Record<string, string>;
    template_dir?: string;
    archive_path_root?: string;
  }) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.configureBootstrap(opts);
  });

  ipcMain.handle('bootstrapProject', (_e, opts: {
    name: string;
    type: string;
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
    path_override?: string;
    skip_git?: boolean;
  }) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.bootstrapProject({
      ...opts,
      type: opts.type as 'project' | 'area_of_focus',
      producer: 'setlist-app',
    });
  });
}
