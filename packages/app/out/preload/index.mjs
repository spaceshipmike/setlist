import { contextBridge, ipcRenderer } from "electron";
const api = {
  // Project Identity
  listProjects: (opts) => ipcRenderer.invoke("listProjects", opts),
  getProject: (name, depth) => ipcRenderer.invoke("getProject", name, depth),
  searchProjects: (opts) => ipcRenderer.invoke("searchProjects", opts),
  getRegistryStats: () => ipcRenderer.invoke("getRegistryStats"),
  register: (opts) => ipcRenderer.invoke("register", opts),
  updateCore: (name, updates) => ipcRenderer.invoke("updateCore", name, updates),
  updateFields: (name, fields, producer) => ipcRenderer.invoke("updateFields", name, fields, producer),
  archiveProject: (name) => ipcRenderer.invoke("archiveProject", name),
  renameProject: (oldName, newName) => ipcRenderer.invoke("renameProject", oldName, newName),
  // spec 0.13: areas + sub-projects
  setProjectArea: (name, area) => ipcRenderer.invoke("setProjectArea", name, area),
  setParentProject: (childName, parentName) => ipcRenderer.invoke("setParentProject", childName, parentName),
  // Profile
  enrichProject: (name, profile) => ipcRenderer.invoke("enrichProject", name, profile),
  // Ports
  listProjectPorts: (projectName) => ipcRenderer.invoke("listProjectPorts", projectName),
  // Capabilities
  queryCapabilities: (opts) => ipcRenderer.invoke("queryCapabilities", opts),
  // Memory (read-only)
  recallMemories: (opts) => ipcRenderer.invoke("recallMemories", opts),
  memoryStatus: (projectId) => ipcRenderer.invoke("memoryStatus", projectId),
  // Bootstrap
  getBootstrapConfig: () => ipcRenderer.invoke("getBootstrapConfig"),
  configureBootstrap: (opts) => ipcRenderer.invoke("configureBootstrap", opts),
  // Health
  assessHealth: (name, opts) => ipcRenderer.invoke("assessHealth", name, opts),
  bootstrapProject: (opts) => ipcRenderer.invoke("bootstrapProject", opts)
};
contextBridge.exposeInMainWorld("setlist", api);
