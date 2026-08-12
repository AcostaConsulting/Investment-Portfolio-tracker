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

/**
 * 🔴 ¿Es este un build para Microsoft Store? Entonces electron-updater NO
 * arranca: las actualizaciones las gestiona la Store.
 *
 * **Dos capas a propósito, no una.** Un fallo aquí significa un paquete de
 * Store que se auto-actualiza por fuera de la Store — y como un MSIX vive en
 * `WindowsApps`, que es de sólo lectura y firmado, `electron-updater` no puede
 * parchearlo: instalaría el NSIS **al lado**, dejando dos Patrimos conviviendo
 * y el escenario de datos divididos de H2 provocado por nosotros (§27.2).
 *
 *  1. `process.windowsStore`: lo que Electron detecta en runtime.
 *  2. `PATRIMO_CANAL`: constante congelada por esbuild en tiempo de build
 *     (`scripts/build-electron.mjs`), que no depende de esa detección.
 *
 * Basta con que UNA diga que sí.
 */
export function esCanalStore(): boolean {
  return process.windowsStore === true || process.env.PATRIMO_CANAL === 'store'
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
  // En el canal Store nunca se contacta a GitHub: actualiza la Store.
  if (esCanalStore()) return { estado: 'sin-actualizacion' }
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
  if (esCanalStore()) return { estado: 'sin-actualizacion' }
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
  if (esCanalStore()) return
  autoUpdater.quitAndInstall(true, true)
}
