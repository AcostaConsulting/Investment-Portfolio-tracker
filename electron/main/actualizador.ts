/**
 * Auto-update opt-in desde GitHub Releases.
 *
 * Reglas de la casa:
 * - Nada se busca ni descarga sin que el usuario lo pida (opt-in en la UI).
 * - Nunca se reinicia solo: tras descargar, el usuario elige entre reiniciar
 *   ya o dejar que se instale cuando él cierre la app.
 */

import { app } from 'electron'
import { appendFileSync, renameSync, statSync } from 'node:fs'
import path from 'node:path'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

export interface EstadoActualizador {
  estado: 'sin-actualizacion' | 'disponible' | 'descargando' | 'lista' | 'error'
  version?: string
  error?: string
}

// El log vive en userData junto a datos.json y prefs.json. Se rota al pasar el
// tope para que no crezca sin control.
const NOMBRE_LOG = 'actualizador.log'
const MAX_LOG = 512 * 1024

function escribir(nivel: string, mensaje?: unknown): void {
  try {
    const archivo = path.join(app.getPath('userData'), NOMBRE_LOG)
    try {
      if (statSync(archivo).size > MAX_LOG) renameSync(archivo, `${archivo}.old`)
    } catch {
      // Todavía no existe: nada que rotar.
    }
    const texto =
      mensaje instanceof Error
        ? (mensaje.stack ?? mensaje.message)
        : typeof mensaje === 'string'
          ? mensaje
          : JSON.stringify(mensaje)
    appendFileSync(archivo, `${new Date().toISOString()} [${nivel}] ${texto}\n`, 'utf8')
  } catch {
    // Mejor-esfuerzo: registrar nunca debe tumbar una actualización.
  }
}

/**
 * Sin esto, electron-updater escribe a `console` y en la app empaquetada eso
 * no lo ve nadie. Un fallo de actualización se quedaba mudo.
 */
const registro = {
  info: (m?: unknown) => escribir('info', m),
  warn: (m?: unknown) => escribir('warn', m),
  error: (m?: unknown) => escribir('error', m),
  debug: (m: string) => escribir('debug', m),
}

let configurado = false

function configurar(): void {
  if (configurado) return
  configurado = true
  autoUpdater.logger = registro
  autoUpdater.autoDownload = false
  // Arranca apagado: si el usuario no pidió descargar, no hay nada que instalar.
  autoUpdater.autoInstallOnAppQuit = false
}

export async function buscar(): Promise<EstadoActualizador> {
  if (!app.isPackaged) return { estado: 'sin-actualizacion' }
  configurar()
  try {
    const resultado = await autoUpdater.checkForUpdates()
    const nueva = resultado?.updateInfo.version
    if (nueva && nueva !== app.getVersion()) {
      return { estado: 'disponible', version: nueva }
    }
    return { estado: 'sin-actualizacion' }
  } catch (error) {
    return { estado: 'error', error: error instanceof Error ? error.message : 'error' }
  }
}

export async function descargar(): Promise<EstadoActualizador> {
  if (!app.isPackaged) return { estado: 'sin-actualizacion' }
  configurar()
  // 🔴 Tiene que quedar en true ANTES de descargar. electron-updater registra el
  // handler de 'quit' dentro del callback de fin de descarga y lo omite si la
  // bandera está apagada en ese instante (BaseUpdater.addQuitHandler). Encenderla
  // después no vuelve a disparar nada: la actualización se descargaba y no se
  // instalaba nunca. Pedir la descarga ya es consentimiento explícito.
  autoUpdater.autoInstallOnAppQuit = true
  try {
    await autoUpdater.downloadUpdate()
    return { estado: 'lista' }
  } catch (error) {
    autoUpdater.autoInstallOnAppQuit = false
    return { estado: 'error', error: error instanceof Error ? error.message : 'error' }
  }
}

/** El usuario eligió reiniciar ya: instala en silencio y vuelve a abrir la app. */
export function instalarAhora(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(true, true)
}
