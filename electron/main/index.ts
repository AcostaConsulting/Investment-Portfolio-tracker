import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import path from 'node:path'
import { cargar, guardar, respaldar } from './almacen'
import { obtenerJson } from './red'
import { abrirArchivo, guardarArchivo, type FiltroArchivo } from './dialogo'
import { buscar, descargar, instalarAlCerrar } from './actualizador'

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

function registrarIpc() {
  ipcMain.handle('almacen:cargar', () => cargar())

  // El respaldo rotativo se hace antes de sobrescribir, mejor-esfuerzo.
  let ultimoRespaldo = 0
  ipcMain.handle('almacen:guardar', async (_evento, documento: unknown) => {
    const ahora = Date.now()
    if (ahora - ultimoRespaldo > 10 * 60 * 1000) {
      ultimoRespaldo = ahora
      await respaldar()
    }
    await guardar(documento)
  })

  ipcMain.handle('red:json', (_evento, url: string) => obtenerJson(url))

  ipcMain.handle(
    'dialogo:guardar',
    (evento, opciones: { sugerido: string; filtros: FiltroArchivo[]; contenidoBase64: string }) => {
      const ventana = BrowserWindow.fromWebContents(evento.sender)
      if (!ventana) return { guardado: false }
      return guardarArchivo(ventana, opciones)
    },
  )

  ipcMain.handle('dialogo:abrir', (evento, opciones: { filtros: FiltroArchivo[] }) => {
    const ventana = BrowserWindow.fromWebContents(evento.sender)
    if (!ventana) return { abierto: false }
    return abrirArchivo(ventana, opciones)
  })

  ipcMain.handle('sistema:info', () => ({
    version: app.getVersion(),
    plataforma: process.platform,
  }))

  ipcMain.handle('actualizador:buscar', () => buscar())
  ipcMain.handle('actualizador:descargar', () => descargar())
  ipcMain.handle('actualizador:instalar', () => instalarAlCerrar())
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

  registrarIpc()
  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
