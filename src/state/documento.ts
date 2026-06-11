/**
 * El documento único que se persiste en disco. Versionado para poder
 * migrar el esquema en futuras versiones sin perder datos.
 */

import type { Activo, Operacion, PrecioActual } from '../engine/tipos'

export type Idioma = 'es' | 'en' | 'fr' | 'zh' | 'ja'
export type Tema = 'claro' | 'oscuro' | 'sistema'

export interface Ajustes {
  monedaBase: string
  idioma: Idioma
  tema: Tema
  /** Retención ISR anual sobre capital, % (la fija Hacienda cada año). */
  tasaIsrAnual: number
  /** Valor vigente de la UDI en MXN (manual o en vivo). */
  udiActual?: number
  diasAlertaVencimiento: number
  /** Opt-in explícito: sin esto la app jamás toca la red. */
  preciosEnVivo: boolean
  /** Opt-in: buscar actualizaciones en GitHub Releases. */
  buscarActualizaciones: boolean
}

export interface Meta {
  id: string
  nombre: string
  /** Monto objetivo en moneda base. */
  objetivo: number
  fechaLimite?: string
  /** Ids de activos que cuentan para la meta; vacío = todo el portafolio. */
  activos: string[]
}

export interface AlertaPrecio {
  id: string
  activoId: string
  condicion: 'mayor' | 'menor'
  /** Umbral en la moneda del activo. */
  precio: number
  activa: boolean
  /** Fecha ISO en que se disparó por última vez. */
  disparada?: string
}

export interface ObjetivoRebalanceo {
  /** Porcentajes objetivo por clase de activo (deben sumar 100). */
  porClase: Partial<Record<'accion' | 'cripto' | 'renta_fija', number>>
}

export interface DocumentoStore {
  version: 1
  activos: Activo[]
  operaciones: Operacion[]
  /** Precios vigentes capturados a mano o traídos en vivo. */
  precios: Record<string, PrecioActual>
  /** Tipos de cambio vigentes: moneda → unidades de moneda base. */
  tiposCambio: Record<string, number>
  ajustes: Ajustes
  /** Cadena de activación pegada por el usuario (se revalida al arrancar). */
  licencia?: string
  metas: Meta[]
  alertasPrecio: AlertaPrecio[]
  rebalanceo?: ObjetivoRebalanceo
  onboardingCompletado: boolean
  tourCompletado: boolean
}

export function documentoInicial(): DocumentoStore {
  return {
    version: 1,
    activos: [],
    operaciones: [],
    precios: {},
    tiposCambio: {},
    ajustes: {
      monedaBase: 'MXN',
      idioma: 'es',
      tema: 'sistema',
      tasaIsrAnual: 1.9,
      diasAlertaVencimiento: 30,
      preciosEnVivo: false,
      buscarActualizaciones: false,
    },
    metas: [],
    alertasPrecio: [],
    onboardingCompletado: false,
    tourCompletado: false,
  }
}

/**
 * Normaliza un documento leído de disco o de un respaldo: rellena campos
 * que no existían en versiones anteriores sin tocar los datos del usuario.
 */
export function migrarDocumento(crudo: unknown): DocumentoStore {
  const base = documentoInicial()
  if (typeof crudo !== 'object' || crudo === null) return base
  const doc = crudo as Partial<DocumentoStore>
  return {
    ...base,
    ...doc,
    version: 1,
    ajustes: { ...base.ajustes, ...(doc.ajustes ?? {}) },
    activos: doc.activos ?? [],
    operaciones: doc.operaciones ?? [],
    precios: doc.precios ?? {},
    tiposCambio: doc.tiposCambio ?? {},
    metas: doc.metas ?? [],
    alertasPrecio: doc.alertasPrecio ?? [],
  }
}
