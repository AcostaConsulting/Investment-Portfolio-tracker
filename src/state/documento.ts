/**
 * El documento único que se persiste en disco. Versionado para poder
 * migrar el esquema en futuras versiones sin perder datos.
 */

import type { Activo, Operacion, PrecioActual } from '../engine/tipos'
import type { ConfigAlerta } from '../engine/alertas'
import type { MetaFinanciera } from '../engine/metas'

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
  /** Umbral del aviso de liquidez (% líquido mínimo deseado). */
  umbralLiquidezPct: number
}

export interface Etiqueta {
  id: string
  nombre: string
  /** Color hex para el badge (de una paleta fija de la UI). */
  color: string
}

/** Metas por clase o totales — la forma vive en el motor. */
export type Meta = MetaFinanciera

/** Alertas con piso/techo — la forma vive en el motor. */
export type AlertaPrecio = ConfigAlerta

/** Benchmark de captura manual: nombre + rendimiento % del período. */
export interface BenchmarkManual {
  id: string
  nombre: string
  rendimientoPct: number
}

export interface ObjetivoRebalanceo {
  /** Porcentajes objetivo por clase de activo (deben sumar 100). */
  porClase: Partial<Record<'accion' | 'cripto' | 'renta_fija', number>>
}

/** Valor total del portafolio al cierre de un día — alimenta los benchmarks. */
export interface PuntoHistorico {
  fecha: string
  valor: number
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
  etiquetas: Etiqueta[]
  metas: Meta[]
  alertasPrecio: AlertaPrecio[]
  benchmarks: BenchmarkManual[]
  rebalanceo?: ObjetivoRebalanceo
  /** Un punto por día con actividad; tope ~3 años. */
  historico: PuntoHistorico[]
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
      tema: 'oscuro',
      tasaIsrAnual: 1.9,
      diasAlertaVencimiento: 30,
      preciosEnVivo: false,
      buscarActualizaciones: false,
      umbralLiquidezPct: 10,
    },
    etiquetas: [],
    metas: [],
    alertasPrecio: [],
    benchmarks: [],
    historico: [],
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
    etiquetas: doc.etiquetas ?? [],
    metas: (doc.metas ?? []).map(migrarMeta),
    alertasPrecio: (doc.alertasPrecio ?? []).map(migrarAlerta),
    benchmarks: doc.benchmarks ?? [],
    historico: doc.historico ?? [],
  }
}

/** Sesión 1 guardaba metas con lista de activos; ahora son por clase o totales. */
function migrarMeta(cruda: Meta & { activos?: string[] }): Meta {
  const { activos: _ignorado, ...meta } = cruda
  return meta
}

/** Sesión 1: {condicion: 'mayor'|'menor', precio} → ahora piso/techo. */
function migrarAlerta(cruda: AlertaPrecio & { condicion?: 'mayor' | 'menor'; precio?: number }): AlertaPrecio {
  if (cruda.condicion && cruda.precio !== undefined) {
    const { condicion, precio, ...resto } = cruda
    return condicion === 'mayor' ? { ...resto, precioMax: precio } : { ...resto, precioMin: precio }
  }
  return cruda
}
