/**
 * Tipos del puente preload visibles para el renderer.
 * Mantener en sincronía con electron/preload/index.ts.
 */

export interface ResultadoGuardarArchivo {
  guardado: boolean
  ruta?: string
  error?: string
}

export interface ResultadoAbrirArchivo {
  abierto: boolean
  nombre?: string
  contenidoBase64?: string
  error?: string
}

export interface RespuestaRed {
  ok: boolean
  estado: number
  datos?: unknown
  error?: string
}

export interface EstadoActualizador {
  estado: 'sin-actualizacion' | 'disponible' | 'descargando' | 'lista' | 'error'
  version?: string
  error?: string
}

export interface ApiPreload {
  almacen: {
    cargar(): Promise<unknown | null>
    guardar(documento: unknown): Promise<void>
  }
  red: {
    json(url: string): Promise<RespuestaRed>
  }
  dialogo: {
    guardar(opciones: {
      sugerido: string
      filtros: { nombre: string; extensiones: string[] }[]
      contenidoBase64: string
    }): Promise<ResultadoGuardarArchivo>
    abrir(opciones: {
      filtros: { nombre: string; extensiones: string[] }[]
    }): Promise<ResultadoAbrirArchivo>
  }
  sistema: {
    info(): Promise<{ version: string; plataforma: string }>
  }
  actualizador: {
    buscar(): Promise<EstadoActualizador>
    descargar(): Promise<EstadoActualizador>
    instalarAlCerrar(): Promise<void>
  }
}

declare global {
  interface Window {
    /** Puede faltar cuando el renderer corre fuera de Electron (ej. vite dev en navegador). */
    api?: ApiPreload
  }
}

export {}
