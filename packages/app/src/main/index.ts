// @fctry: #auto-update
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc.js';
import { initAutoUpdater } from './auto-update.js';
import { loadPrefs } from './prefs.js';
import { installAppMenu, handleMenuCheckForUpdates } from './menu.js';
import { registerQuitPrompt } from './quit-prompt.js';

// Single-instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1A1915',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for better-sqlite3 via preload
    },
  });

  // Catch renderer crashes
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] Renderer process gone:', details.reason, details.exitCode);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[main] Failed to load:', code, desc);
  });
  mainWindow.webContents.on('console-message', (_e, level, msg) => {
    const labels = ['V', 'I', 'W', 'E'];
    console.log(`[renderer:${labels[level] || level}] ${msg}`);
  });

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    console.log('[main] Loading URL:', process.env.ELECTRON_RENDERER_URL);
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const htmlPath = join(__dirname, '..', 'renderer', 'index.html');
    console.log('[main] Loading file:', htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Focus existing window on second instance
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Load persisted user prefs (update channel, last-check status).
  // Side effect: caches to memory so subsequent reads in this session
  // are instant.
  loadPrefs();

  registerIpcHandlers(ipcMain);

  // Install the macOS app menu (About + Check for Updates…). Always
  // installed so the About dialog is reachable in dev too; the
  // Check for Updates… item is disabled in dev.
  installAppMenu(handleMenuCheckForUpdates);

  createWindow();

  // Auto-update (skip in dev — Chunk 2 reads the channel from prefs).
  if (!process.env.ELECTRON_RENDERER_URL) {
    initAutoUpdater();
    // Intercept quit when an update is staged so the user gets the
    // Install/Skip prompt (S89). Only in production — no staged
    // updates are possible in dev.
    registerQuitPrompt(app, () => mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
