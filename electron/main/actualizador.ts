/**
 * Auto-update opt-in desde GitHub Releases.
 *
 * Reglas de la casa:
 * - Nada se busca ni descarga sin que el usuario lo pida (opt-in en la UI).
 * - Nunca se reinicia solo: la actualización descargada se instala cuando
 *   el usuario cierra la app, y solo si él eligió descargarla.
 */

import { app } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

export interface EstadoActualizador {
  estado: 'sin-actualizacion' | 'disponible' | 'descargando' | 'lista' | 'error'
  version?: string
  error?: string
}

let configurado = false

function configurar(): void {
  if (configurado) return
  configurado = true
  autoUpdater.autoDownload = false
  // Solo instala al salir si el usuario descargó la actualización a propósito.
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
  try {
    await autoUpdater.downloadUpdate()
    return { estado: 'lista' }
  } catch (error) {
    return { estado: 'error', error: error instanceof Error ? error.message : 'error' }
  }
}

/** El usuario aceptó: se instala silenciosamente cuando ÉL cierre la app. */
export function instalarAlCerrar(): void {
  autoUpdater.autoInstallOnAppQuit = true
}
