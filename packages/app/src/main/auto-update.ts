import pkg from 'electron-updater'
const { autoUpdater } = pkg

export function initAutoUpdater(channel: 'latest' | 'beta' = 'latest'): void {
  autoUpdater.channel = channel
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
