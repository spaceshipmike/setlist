// @fctry: #auto-update
import pkg from 'electron-updater'
import { getChannel } from './prefs.js'
const { autoUpdater } = pkg

export function initAutoUpdater(channel?: 'latest' | 'beta' | 'stable'): void {
  // Map spec's "stable" to electron-updater's "latest" tag naming.
  const resolved = channel ?? getChannel()
  autoUpdater.channel = resolved === 'stable' ? 'latest' : resolved
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('[auto-update] Update available:', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[auto-update] Update downloaded:', info.version, '— will install on quit')
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-update] Error:', err.message)
  })

  autoUpdater.checkForUpdatesAndNotify()
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000)
}

export function setUpdateChannel(channel: 'latest' | 'beta'): void {
  autoUpdater.channel = channel
  autoUpdater.checkForUpdatesAndNotify()
}
