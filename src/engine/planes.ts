/**
 * Capacidades por plan y matriz de comparación para el modal de planes.
 * Puro: construye datos, la UI solo los pinta.
 */

import { tieneCapacidad, type Plan } from '../licencias/planes'

export const PLANES: Plan[] = ['free', 'pro', 'premium', 'lifetime']

export interface CapacidadesPlan {
  activosIlimitados: boolean
  importarExcel: boolean
  exportarExcel: boolean
  rentaFijaMexicana: boolean
  preciosEnVivo: boolean
  alertasPrecio: boolean
  analisisComisiones: boolean
  benchmarks: boolean
  rebalanceo: boolean
  metas: boolean
  /** Etiquetas por activo: número máximo o sin límite. */
  maxEtiquetasPorActivo: number | 'ilimitadas'
  /** % de descuento en consultoría fiscal. */
  descuentoConsultoria: number
  actualizacionesIncluidas: boolean
}

export const DESCUENTO_CONSULTORIA: Record<Plan, number> = {
  free: 0,
  pro: 10,
  premium: 15,
  lifetime: 20,
}

export function obtenerCapacidades(plan: Plan): CapacidadesPlan {
  return {
    activosIlimitados: true,
    importarExcel: tieneCapacidad(plan, 'importarExcel'),
    exportarExcel: tieneCapacidad(plan, 'exportarExcel'),
    rentaFijaMexicana: true,
    preciosEnVivo: tieneCapacidad(plan, 'preciosEnVivo'),
    alertasPrecio: tieneCapacidad(plan, 'alertasPrecio'),
    analisisComisiones: tieneCapacidad(plan, 'analisisComisiones'),
    benchmarks: tieneCapacidad(plan, 'benchmarks'),
    rebalanceo: tieneCapacidad(plan, 'rebalanceo'),
    metas: tieneCapacidad(plan, 'metas'),
    maxEtiquetasPorActivo: tieneCapacidad(plan, 'etiquetasIlimitadas') ? 'ilimitadas' : 1,
    descuentoConsultoria: DESCUENTO_CONSULTORIA[plan],
    actualizacionesIncluidas: true,
  }
}

/** Celda de la tabla: palomita/cruz o un texto corto ("1", "∞", "10%"). */
export type CeldaComparacion = boolean | string

export interface FilaComparacion {
  /** Llave i18n-able de la feature (planes.features.<clave>). */
  clave: keyof CapacidadesPlan
  porPlan: Record<Plan, CeldaComparacion>
}

export interface ComparacionPlanes {
  planes: Plan[]
  filas: FilaComparacion[]
}

function aCelda(clave: keyof CapacidadesPlan, valor: CapacidadesPlan[keyof CapacidadesPlan]): CeldaComparacion {
  if (typeof valor === 'boolean') return valor
  if (valor === 'ilimitadas') return '∞'
  if (typeof valor === 'number') {
    if (clave === 'descuentoConsultoria') return valor === 0 ? false : `${valor}%`
    return String(valor)
  }
  return String(valor)
}

/** Matriz completa para renderizar la tabla del modal. */
export function compararPlanes(): ComparacionPlanes {
  const capacidades = Object.fromEntries(PLANES.map((p) => [p, obtenerCapacidades(p)])) as Record<
    Plan,
    CapacidadesPlan
  >
  const claves = Object.keys(capacidades.free) as (keyof CapacidadesPlan)[]
  return {
    planes: PLANES,
    filas: claves.map((clave) => ({
      clave,
      porPlan: Object.fromEntries(PLANES.map((p) => [p, aCelda(clave, capacidades[p][clave])])) as Record<
        Plan,
        CeldaComparacion
      >,
    })),
  }
}
