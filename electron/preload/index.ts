import { contextBridge, ipcRenderer } from 'electron'

/**
 * Puente único entre renderer y main. La superficie se mantiene mínima y
 * tipada (ver src/shared/api.d.ts): el renderer jamás ve Node ni Electron.
 */
const api = {
  almacen: {
    cargar: (): Promise<unknown | null> => ipcRenderer.invoke('almacen:cargar'),
    guardar: (documento: unknown): Promise<void> => ipcRenderer.invoke('almacen:guardar', documento),
  },
  red: {
    json: (url: string): Promise<unknown> => ipcRenderer.invoke('red:json', url),
  },
  dialogo: {
    guardar: (opciones: {
      sugerido: string
      filtros: { nombre: string; extensiones: string[] }[]
      contenidoBase64: string
    }): Promise<{ guardado: boolean; ruta?: string; error?: string }> =>
      ipcRenderer.invoke('dialogo:guardar', opciones),
    abrir: (opciones: {
      filtros: { nombre: string; extensiones: string[] }[]
    }): Promise<{ abierto: boolean; nombre?: string; contenidoBase64?: string; error?: string }> =>
      ipcRenderer.invoke('dialogo:abrir', opciones),
  },
  sistema: {
    info: (): Promise<{ version: string; plataforma: string }> => ipcRenderer.invoke('sistema:info'),
  },
  actualizador: {
    buscar: (): Promise<unknown> => ipcRenderer.invoke('actualizador:buscar'),
    descargar: (): Promise<unknown> => ipcRenderer.invoke('actualizador:descargar'),
    instalarAlCerrar: (): Promise<void> => ipcRenderer.invoke('actualizador:instalar'),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiPreload = typeof api
