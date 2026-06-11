import { app, BrowserWindow, session, shell } from 'electron'
import path from 'node:path'

const esDev = !!process.env.VITE_DEV_SERVER_URL

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#14120F',
    title: 'Tracker de Portafolio',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  ventana.once('ready-to-show', () => ventana.show())

  // Cualquier intento de abrir un enlace externo va al navegador del sistema,
  // nunca dentro de la app.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (esDev) {
    ventana.loadURL(process.env.VITE_DEV_SERVER_URL!)
    ventana.webContents.openDevTools({ mode: 'detach' })
  } else {
    ventana.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  return ventana
}

app.whenReady().then(() => {
  // CSP estricta solo en producción (en dev, Vite necesita inline scripts para HMR).
  if (!esDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'",
          ],
        },
      })
    })
  }

  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
