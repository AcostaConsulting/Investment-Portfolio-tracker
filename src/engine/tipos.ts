/**
 * Tipos de dominio del Tracker de Portafolio.
 *
 * Convención: el vocabulario de dominio va en español (es el idioma del
 * producto y del dueño; CETES, ISR y UDI no se traducen). El motor completo
 * es puro: ninguna función toca DOM, Electron ni red.
 *
 * Dinero: todos los montos son números en la moneda indicada. La conversión
 * a moneda base usa el tipo de cambio capturado en la operación
 * (`tipoCambio` = cuántas unidades de moneda base vale 1 unidad de la
 * moneda de la operación).
 */

export type ClaseActivo = 'accion' | 'cripto' | 'renta_fija'

export type TipoOperacion =
  | 'compra'
  | 'venta'
  | 'dividendo'
  | 'interes'
  | 'staking'
  | 'ajuste'
  | 'airdrop'
  | 'recompensa'

/** Operaciones que aumentan tenencia sin ser compra (costo = precio capturado, puede ser 0). */
export const OPERACIONES_EN_ESPECIE: ReadonlySet<TipoOperacion> = new Set([
  'staking',
  'airdrop',
  'recompensa',
])

/** Operaciones de ingreso en efectivo (no cambian la cantidad del activo). */
export const OPERACIONES_EFECTIVO: ReadonlySet<TipoOperacion> = new Set([
  'dividendo',
  'interes',
])

export interface Operacion {
  id: string
  activoId: string
  tipo: TipoOperacion
  /** Fecha ISO `YYYY-MM-DD`. */
  fecha: string
  /**
   * Unidades del activo. Para dividendo/interés se usa junto con
   * `precioUnitario` para expresar el importe (ej. cantidad=500, precio=1
   * para "$500 de intereses"). Para ajuste puede ser negativa.
   */
  cantidad: number
  /** Precio por unidad en `moneda`. */
  precioUnitario: number
  /** Código ISO 4217 de la operación (MXN, USD, ...). */
  moneda: string
  /** 1 unidad de `moneda` = `tipoCambio` unidades de la moneda base. 1 si es la base. */
  tipoCambio: number
  /** Comisión en `moneda` (siempre ≥ 0). */
  comision?: number
  nota?: string
}

export type InstrumentoRentaFija =
  | 'cetes'
  | 'bono_m'
  | 'udibono'
  | 'pagare'
  | 'sofipo'
  | 'ahorro'

export interface DetalleRentaFija {
  instrumento: InstrumentoRentaFija
  /**
   * Tasa anual en porcentaje (ej. 10.25). Significado por instrumento:
   * cetes → tasa de rendimiento; bono_m/udibono → tasa cupón;
   * pagare/sofipo → tasa simple; ahorro → tasa variable vigente.
   */
  tasaAnual: number
  /** Fecha ISO de inicio/compra de la inversión. */
  fechaInicio: string
  /** Fecha ISO de vencimiento. `ahorro` no tiene. */
  fechaVencimiento?: string
  /** Valor nominal por título (10 CETES, 100 bonos). Omitir para inversiones por monto. */
  valorNominal?: number
  /** Valor de la UDI al inicio (solo udibono). */
  udiInicial?: number
  /** Sobrescribe la tasa de retención ISR global para este instrumento (% anual sobre capital). */
  tasaIsr?: number
}

export interface Activo {
  id: string
  /** Ticker o clave corta visible (AAPL, BTC, CETES-28). */
  simbolo: string
  nombre: string
  clase: ClaseActivo
  /** Moneda natural de cotización del activo. */
  moneda: string
  rentaFija?: DetalleRentaFija
}

/** Precio vigente de un activo, capturado manualmente o traído en vivo (opt-in). */
export interface PrecioActual {
  precio: number
  moneda: string
  /** Fecha ISO del dato, para mostrar qué tan fresco es. */
  actualizado?: string
}

/**
 * Contexto de valuación: precios vigentes por activo y tipos de cambio
 * vigentes hacia la moneda base (1 unidad de la clave = X base).
 */
export interface ContextoValuacion {
  monedaBase: string
  /** Fecha ISO "hoy" — inyectada para que el motor sea determinista. */
  hoy: string
  precios: Record<string, PrecioActual>
  /** Tipos de cambio vigentes: moneda → unidades de moneda base. */
  tiposCambio: Record<string, number>
  /** Valor vigente de la UDI en MXN (para UDIBONOS). */
  udiActual?: number
  /** Tasa de retención ISR anual sobre capital, en %. Default 1.9. */
  tasaIsrAnual?: number
}

export interface Advertencia {
  codigo: 'venta_excede_tenencia' | 'ajuste_excede_tenencia' | 'sin_tipo_cambio' | 'sin_precio'
  activoId: string
  operacionId?: string
  detalle?: string
}
