/** Orden de la tabla de posiciones: puro y sin estado, para poder probarlo. */

import type { Posicion } from '../../engine/portafolio'

export type ColumnaOrden = 'simbolo' | 'cantidad' | 'valor' | 'pnl' | 'rendimiento'
export type DireccionOrden = 'asc' | 'desc'

const NUMERICO: Record<Exclude<ColumnaOrden, 'simbolo'>, (p: Posicion) => number> = {
  cantidad: (p) => p.cantidad,
  valor: (p) => p.valorBase ?? 0,
  pnl: (p) => p.pnlNoRealizadoBase ?? 0,
  rendimiento: (p) => p.rendimientoPct ?? 0,
}

/** Devuelve una copia ordenada; nunca muta la entrada. */
export function ordenarPosiciones(
  posiciones: Posicion[],
  col: ColumnaOrden,
  dir: DireccionOrden,
): Posicion[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...posiciones].sort((a, b) => {
    if (col === 'simbolo') {
      return factor * a.activo.simbolo.localeCompare(b.activo.simbolo, undefined, { sensitivity: 'base' })
    }
    const obtener = NUMERICO[col]
    return factor * (obtener(a) - obtener(b))
  })
}
