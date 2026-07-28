import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import path from 'node:path'
import { cargar, guardar, respaldar, leerZoom, guardarZoom } from './almacen'
import { obtenerJson } from './red'
import { abrirArchivo, guardarArchivo, type FiltroArchivo } from './dialogo'
import { buscar, descargar, instalarAhora } from './actualizador'

const esDev = !!process.env.VITE_DEV_SERVER_URL

// Zoom de la interfaz (Ctrl/Cmd con +, − y 0). Preferencia local de la máquina.
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_PASO = 0.1
let zoomFactor = 1
const clampZoom = (f: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(f * 10) / 10))

function aplicarZoom(ventana: BrowserWindow, f: number): void {
  zoomFactor = clampZoom(f)
  ventana.webContents.setZoomFactor(zoomFactor)
  void guardarZoom(zoomFactor)
}

function configurarZoom(ventana: BrowserWindow): void {
  // Aplicar el zoom guardado en cada carga (también tras un HMR en dev).
  ventana.webContents.on('did-finish-load', () => ventana.webContents.setZoomFactor(zoomFactor))
  ventana.webContents.on('before-input-event', (evento, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return
    const actual = ventana.webContents.getZoomFactor()
    let nuevo: number | undefined
    if (input.key === '=' || input.key === '+') nuevo = actual + ZOOM_PASO
    else if (input.key === '-') nuevo = actual - ZOOM_PASO
    else if (input.key === '0') nuevo = 1
    if (nuevo === undefined) return
    evento.preventDefault() // evita el doble-zoom del menú/navegador integrado
    aplicarZoom(ventana, nuevo)
  })
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#0F172A',
    // Solo la marca visible. productName (package.json / electron-builder.yml)
    // NO se toca: define userData y la carpeta de instalación.
    title: 'Patrimo',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  ventana.once('ready-to-show', () => ventana.show())
  configurarZoom(ventana)

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
  ipcMain.handle('actualizador:instalar', () => instalarAhora())
}

app.whenReady().then(async () => {
  zoomFactor = clampZoom((await leerZoom()) ?? 1)

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
