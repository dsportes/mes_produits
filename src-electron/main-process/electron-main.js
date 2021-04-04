/*
Ce module est quasiment inchangé par rapport au module par défaut de electron/quasar
- obtention de la taille de la fenêtre à l'ouverture quand on ne prend pas celle par défaut de 800x600
- pas de menu dans la fenêtre en production
*/

import { app, BrowserWindow, nativeTheme } from 'electron'

try {
  if (process.platform === 'win32' && nativeTheme.shouldUseDarkColors === true) {
    require('fs').unlinkSync(require('path').join(app.getPath('userData'), 'DevTools Extensions'))
  }
} catch (_) { }

/**
 * Set `__statics` path to static files in production;
 * The reason we are setting it here is that the path needs to be evaluated at runtime
 */
if (process.env.PROD) {
  global.__statics = require('path').join(__dirname, 'statics').replace(/\\/g, '\\\\')
}

/*
Obtention de la largeur et de la hauteur de la fenêtre de l'application passées sur la ligne de commande :
produits h=600 l=800
*/
const argv = process.argv
let hauteur = 700
let largeur = 1000
for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x && x.startsWith('h=')) {
      hauteur = parseInt(x.substring(2), 10)
    } else if (x && x.startsWith('l=')) {
      largeur = parseInt(x.substring(2), 10)
    }
}

let mainWindow

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: largeur,
    height: hauteur,
    autoHideMenuBar: true,
    webPreferences: {
      // Change from /quasar.conf.js > electron > nodeIntegration;
      // More info: https://quasar.dev/quasar-cli/developing-electron-apps/node-integration
      nodeIntegration: process.env.QUASAR_NODE_INTEGRATION,
      nodeIntegrationInWorker: process.env.QUASAR_NODE_INTEGRATION,

      // More info: /quasar-cli/developing-electron-apps/electron-preload-script
      // preload: path.resolve(__dirname, 'electron-preload.js')
    }
})

  mainWindow.loadURL(process.env.APP_URL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
