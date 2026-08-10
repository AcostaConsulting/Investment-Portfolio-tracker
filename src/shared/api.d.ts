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

/** Lo que se sabe de un respaldo sin cargarlo (pantalla de recuperación). */
export interface ResumenRespaldo {
  nombre: string
  fechaIso: string
  bytes: number
  activos: number | null
  operaciones: number | null
  legible: boolean
}

/**
 * `vacio` (no hay archivo) e `ilegible` (hay archivo y no se puede leer) son
 * cosas distintas. Confundirlas era el bug #3 de AUDITORIA-ROBUSTEZ.md.
 */
export type ResultadoCarga =
  | { estado: 'vacio' }
  | { estado: 'ok'; documento: unknown }
  | { estado: 'ilegible'; error: string; bytes: number; copia: string | null; respaldos: ResumenRespaldo[] }

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; codigo: string; error: string; ruta: string }

export interface ApiPreload {
  almacen: {
    cargar(): Promise<ResultadoCarga>
    guardar(documento: unknown): Promise<ResultadoGuardado>
    leerRespaldo(nombre: string): Promise<{ ok: true; documento: unknown } | { ok: false; error: string }>
    prepararRecuperacion(): Promise<{ copia: string | null; bytes: number; respaldos: ResumenRespaldo[] }>
    alPedirFlush(cb: () => void): void
    flushListo(): void
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
    instalarAhora(): Promise<void>
  }
}

declare global {
  interface Window {
    /** Puede faltar cuando el renderer corre fuera de Electron (ej. vite dev en navegador). */
    api?: ApiPreload
  }
}

export {}
