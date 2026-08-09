/**
 * Corrección hacia atrás del tipo de cambio de operaciones ya capturadas.
 *
 * Durante mucho tiempo la app sugirió al capturar un TC que no era el
 * fiscalmente aplicable (§19.1): venía de una referencia de mercado y usaba la
 * fecha de la operación, sin el desfase de dos días hábiles que manda la norma.
 * Este módulo permite ponerlas al día.
 *
 * 🔴 **Esto cambia números que el usuario ya vio.** Reescribir `tipoCambio`
 * mueve el costo base, la ganancia realizada y los dividendos del reporte
 * fiscal. Por eso el módulo se parte en dos: `correccionesTcDof` sólo
 * **propone** y `aplicarCorrecciones` sólo **aplica lo que se le pasa**. La UI
 * enseña el antes y el después y el usuario decide. Nunca en silencio.
 *
 * Puro: ni red, ni store, ni fechas del sistema.
 */

import type { Operacion } from './tipos'
import { tcDofAplicable, type TablaFix } from './tcDof'

/** Diferencia por debajo de la cual no vale la pena proponer un cambio. */
const EPSILON_TC = 1e-9

export interface CorreccionTc {
  operacionId: string
  fecha: string
  activoId: string
  tipo: Operacion['tipo']
  moneda: string
  /** El que está guardado hoy. */
  tcActual: number
  /** Fecha de determinación del FIX que corresponde. */
  fechaFix: string
  /** El que debería estar. */
  tcDof: number
  /** Importe bruto en la moneda de la operación. */
  brutoMoneda: number
  importeActualBase: number
  importeDofBase: number
}

/** Importe bruto de la operación en su propia moneda. */
function brutoDe(op: Operacion): number {
  return op.importeEfectivo !== undefined ? op.importeEfectivo : op.cantidad * op.precioUnitario
}

/**
 * Propone correcciones para las operaciones a las que aplica la regla del DOF.
 *
 * Se salta, sin ruido y sin inventar nada:
 * - las que ya están en la moneda base,
 * - las de monedas a las que no aplica la regla (sólo USD→MXN por ahora),
 * - las que la serie empaquetada no alcanza a resolver,
 * - las que ya traen el TC correcto.
 */
export function correccionesTcDof(
  operaciones: Operacion[],
  tabla: TablaFix,
  monedaBase: string,
  monedaDof = 'USD',
  baseDof = 'MXN',
): CorreccionTc[] {
  if (monedaBase !== baseDof) return []
  const correcciones: CorreccionTc[] = []

  for (const op of operaciones) {
    if (op.moneda !== monedaDof) continue
    const dof = tcDofAplicable(tabla, op.fecha)
    if (!dof) continue
    if (Math.abs(dof.tasa - op.tipoCambio) < EPSILON_TC) continue

    const bruto = brutoDe(op)
    correcciones.push({
      operacionId: op.id,
      fecha: op.fecha,
      activoId: op.activoId,
      tipo: op.tipo,
      moneda: op.moneda,
      tcActual: op.tipoCambio,
      fechaFix: dof.fechaFix,
      tcDof: dof.tasa,
      brutoMoneda: bruto,
      importeActualBase: bruto * op.tipoCambio,
      importeDofBase: bruto * dof.tasa,
    })
  }

  return correcciones
}

export interface ResumenCorrecciones {
  total: number
  /** Cambio neto en importes brutos, en moneda base. */
  deltaBase: number
  porTipo: Record<string, number>
}

/** Agrega el efecto de un conjunto de correcciones, para poder mostrarlo antes de aplicar. */
export function resumirCorrecciones(correcciones: CorreccionTc[]): ResumenCorrecciones {
  const porTipo: Record<string, number> = {}
  let deltaBase = 0
  for (const c of correcciones) {
    const delta = c.importeDofBase - c.importeActualBase
    deltaBase += delta
    porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + delta
  }
  return { total: correcciones.length, deltaBase, porTipo }
}

/**
 * Devuelve las operaciones con el `tipoCambio` corregido. No muta la entrada
 * y **no toca ningún otro campo**: sólo el tipo de cambio de las operaciones
 * que vengan en la lista.
 */
export function aplicarCorrecciones(
  operaciones: Operacion[],
  correcciones: CorreccionTc[],
): Operacion[] {
  if (correcciones.length === 0) return operaciones
  const porId = new Map(correcciones.map((c) => [c.operacionId, c.tcDof]))
  return operaciones.map((op) => {
    const tc = porId.get(op.id)
    return tc === undefined ? op : { ...op, tipoCambio: tc }
  })
}
