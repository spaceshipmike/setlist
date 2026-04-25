// @fctry: #health-assessment
// @fctry: #auto-update
import type { IpcMain } from 'electron';
import { app, dialog, BrowserWindow } from 'electron';
import { Registry, MemoryStore, MemoryRetrieval, Bootstrap, HealthAssessor } from '@setlist/core';
import { getChannel, setChannel, getLastCheck, type UpdateChannel } from './prefs.js';
import {
  applyChannel,
  checkForUpdates,
  isCheckInFlight,
  isUpdateDownloaded,
  getDownloadedVersion,
  quitAndInstall,
} from './auto-update.js';

function isDev(): boolean {
  return Boolean(process.env.ELECTRON_RENDERER_URL);
}

let registry: Registry | null = null;
let healthAssessor: HealthAssessor | null = null;

function getRegistry(): Registry {
  if (!registry) registry = new Registry();
  return registry;
}

function getHealth(): HealthAssessor {
  if (!healthAssessor) healthAssessor = new HealthAssessor(getRegistry().dbPath);
  return healthAssessor;
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

  // ── Areas + Sub-Projects (spec 0.13) ─────────────────────────

  ipcMain.handle('setProjectArea', (_e, name: string, area: string | null) => {
    return reg.setProjectArea(name, area);
  });

  ipcMain.handle('setParentProject', (_e, childName: string, parentName: string | null) => {
    return reg.setParentProject(childName, parentName);
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
      project_id: opts.project,
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

  // ── Health ───────────────────────────────────────────────────

  ipcMain.handle('assessHealth', (_e, name?: string, opts?: { fresh?: boolean }) => {
    const health = getHealth();
    const noCache = Boolean(opts?.fresh);
    if (name) return health.assessProject(name, { noCache });
    return health.assessPortfolio({ noCache });
  });

  // ── Auto-Update (#auto-update) ───────────────────────────────

  ipcMain.handle('getUpdateStatus', () => {
    return {
      channel: getChannel(),
      version: app.getVersion(),
      last_check: getLastCheck(),
      in_flight: isCheckInFlight(),
      downloaded: isUpdateDownloaded(),
      downloaded_version: getDownloadedVersion(),
      dev_mode: isDev(),
    };
  });

  ipcMain.handle('setUpdateChannel', (_e, channel: UpdateChannel) => {
    setChannel(channel);
    if (!isDev()) applyChannel(channel);
    return getChannel();
  });

  ipcMain.handle('checkForUpdates', async () => {
    if (isDev()) return { dev_skip: true };
    const initiated = await checkForUpdates();
    return { initiated };
  });

  ipcMain.handle('quitAndInstallUpdate', () => {
    if (!isUpdateDownloaded()) return false;
    quitAndInstall();
    return true;
  });

  ipcMain.handle('pickDirectory', async (e, opts?: { defaultPath?: string; title?: string }) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const result = await dialog.showOpenDialog(parent as BrowserWindow, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: opts?.defaultPath,
      title: opts?.title ?? 'Select folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('bootstrapProject', (_e, opts: {
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
  }) => {
    const bootstrap = new Bootstrap(reg.dbPath);
    return bootstrap.bootstrapProject({
      ...opts,
      // spec 0.26: project_type_id (when present) drives the bootstrap. The
      // legacy 'project' / 'non_code_project' string is still accepted for
      // callers that haven't migrated.
      type: opts.type as 'project' | 'non_code_project' | undefined,
      producer: 'setlist-app',
    });
  });

  // ── Areas (spec 0.26) ────────────────────────────────────────

  ipcMain.handle('areas:list', () => {
    return reg.listAreas();
  });

  ipcMain.handle('areas:create', (_e, opts: { name: string; display_name?: string; description?: string; color: string }) => {
    return reg.createArea(opts);
  });

  ipcMain.handle('areas:update', (_e, id: number, patch: { name?: string; display_name?: string; description?: string; color?: string }) => {
    return reg.updateArea(id, patch);
  });

  ipcMain.handle('areas:delete', (_e, id: number) => {
    reg.deleteArea(id);
    return { ok: true };
  });

  // ── Project types (spec 0.26) ────────────────────────────────

  ipcMain.handle('projectTypes:list', () => {
    return reg.listProjectTypes();
  });

  ipcMain.handle('projectTypes:create', (_e, opts: {
    name: string;
    default_directory: string;
    git_init: boolean;
    template_directory?: string | null;
    color?: string | null;
  }) => {
    return reg.createProjectType(opts);
  });

  ipcMain.handle('projectTypes:update', (_e, id: number, patch: {
    name?: string;
    default_directory?: string;
    git_init?: boolean;
    template_directory?: string | null;
    color?: string | null;
  }) => {
    return reg.updateProjectType(id, patch);
  });

  ipcMain.handle('projectTypes:delete', (_e, id: number) => {
    reg.deleteProjectType(id);
    return { ok: true };
  });
}
