import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import path from 'node:path'
import { cargar, guardar, leerRespaldo, prepararRecuperacion, respaldar, leerZoom, guardarZoom } from './almacen'
import { obtenerJson } from './red'
import { abrirArchivo, guardarArchivo, type FiltroArchivo } from './dialogo'
import { buscar, descargar, instalarAhora } from './actualizador'

const esDev = !!process.env.VITE_DEV_SERVER_URL

/**
 * 🔴 Candado de instancia única.
 *
 * Sin esto, dos ventanas abren el MISMO `datos.json`, cada una con su copia en
 * memoria y su guardado con debounce: la última en escribir gana y el trabajo
 * de la otra desaparece **sin aviso**. Medido en la auditoría: una ventana con
 * el documento viejo cambió el tema y **borró 50 operaciones** que la otra
 * acababa de guardar (AUDITORIA-ROBUSTEZ.md §1.1). El disparador no es exótico:
 * doble clic en el ícono, o abrirla desde el menú de inicio teniendo una
 * ventana ya abierta.
 *
 * El candado de Electron está acotado al `--user-data-dir`, **no** a la
 * aplicación — comprobado corriendo dos Electron con userData distinto y viendo
 * que las dos obtienen el candado. Por eso NO hace falta condicionarlo a
 * `app.isPackaged`: `npm run dev:aislado` (carpeta desechable) y la app
 * instalada (`%APPDATA%`) conviven igual que antes, y de paso dev también queda
 * protegido contra sí mismo, que es como ocurrió el casi-accidente de §8.
 */
const obtuvoCandado = app.requestSingleInstanceLock()
if (!obtuvoCandado) app.quit()

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
  configurarCierreConGuardado(ventana)

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

/**
 * El guardado del renderer va con debounce de 600 ms. Al cerrar la ventana ese
 * temporizador quedaba abandonado y **lo capturado en el último medio segundo
 * se perdía en silencio** — medido: cerrar con la X 150 ms después de un cambio
 * lo perdía; a 900 ms sobrevivía (AUDITORIA-ROBUSTEZ.md, hallazgo #8).
 *
 * Aquí se retiene el cierre, se le pide al renderer que vacíe lo pendiente y se
 * espera su confirmación. El timeout existe para que un renderer colgado no
 * deje una ventana que no se puede cerrar: preferimos perder el último cambio a
 * secuestrar la app.
 *
 * `taskkill /F` y un corte de luz siguen sin poder interceptarse: eso es
 * inherente, no un pendiente.
 */
const ESPERA_FLUSH_MS = 3000
function configurarCierreConGuardado(ventana: BrowserWindow): void {
  let confirmado = false
  ventana.on('close', (evento) => {
    if (confirmado || ventana.webContents.isDestroyed()) return
    evento.preventDefault()
    confirmado = true

    const cerrarYa = () => {
      ipcMain.removeListener('almacen:flush-listo', alListo)
      clearTimeout(temporizador)
      if (!ventana.isDestroyed()) ventana.close()
    }
    const alListo = () => cerrarYa()
    const temporizador = setTimeout(cerrarYa, ESPERA_FLUSH_MS)

    ipcMain.once('almacen:flush-listo', alListo)
    ventana.webContents.send('almacen:pedir-flush')
  })
}

function registrarIpc() {
  ipcMain.handle('almacen:cargar', () => cargar())
  ipcMain.handle('almacen:leerRespaldo', (_evento, nombre: string) => leerRespaldo(nombre))
  ipcMain.handle('almacen:prepararRecuperacion', () => prepararRecuperacion())

  // El respaldo rotativo se hace antes de sobrescribir, mejor-esfuerzo.
  let ultimoRespaldo = 0
  // Antes esto lanzaba y `store.ts` descartaba el rechazo con `void`: guardar
  // contra un archivo bloqueado por OneDrive o marcado de solo lectura fallaba
  // **en absoluto silencio** (AUDITORIA-ROBUSTEZ.md §1.2). Ahora el resultado
  // es un valor que el renderer tiene que mirar.
  ipcMain.handle('almacen:guardar', async (_evento, documento: unknown, forzar?: boolean) => {
    const ahora = Date.now()
    if (ahora - ultimoRespaldo > 10 * 60 * 1000) {
      ultimoRespaldo = ahora
      await respaldar()
    }
    try {
      const r = await guardar(documento, { forzar: forzar === true })
      // Conflicto: alguien más escribió desde que cargamos (§22.3). No se pisa
      // su trabajo; las dos versiones ya quedaron respaldadas.
      if (r.ok === false) return r
      return { ok: true as const }
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      return {
        ok: false as const,
        codigo: err.code ?? 'DESCONOCIDO',
        error: err.message ?? 'No se pudo guardar',
        ruta: app.getPath('userData'),
      }
    }
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

/** La ventana principal, para poder enfocarla cuando llegue una segunda instancia. */
let ventanaPrincipal: BrowserWindow | null = null

// Si otro proceso intenta abrir la app con el mismo userData, no arranca: en su
// lugar despierta ESTA ventana. Es lo que el usuario quería al hacer doble clic.
app.on('second-instance', () => {
  if (!ventanaPrincipal || ventanaPrincipal.isDestroyed()) return
  if (ventanaPrincipal.isMinimized()) ventanaPrincipal.restore()
  ventanaPrincipal.show()
  ventanaPrincipal.focus()
})

app.whenReady().then(async () => {
  // Segunda instancia: ya se pidió salir arriba, no hay nada que montar.
  if (!obtuvoCandado) return
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
  ventanaPrincipal = crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) ventanaPrincipal = crearVentana()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
