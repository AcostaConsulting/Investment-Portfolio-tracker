/**
 * Orden intradía EXPLÍCITO.
 *
 * POR QUÉ EXISTE (AUDITORIA-ROBUSTEZ.md #6): `compararPorFecha` desempataba las
 * operaciones del mismo día por `id`, y el `id` es un `crypto.randomUUID()`
 * generado en el instante de guardar. El resultado era determinista por
 * documento —mismo archivo, mismo orden siempre— pero **el orden no significaba
 * nada**: lo decidió un volado. Medido en §21.1: las mismas tres operaciones de
 * un día dieron un realizado de **−500, 0 o +1500** según qué UUID tocó.
 *
 * Con costo promedio ponderado casi nunca se nota. Con lotes (PEPS o costo
 * identificado) decide **qué lote se vendió primero**, o sea la ganancia que se
 * declara. Por eso §15.8 lo marcó como el **Paso 2, prerrequisito de PEPS**.
 *
 * LA DECISIÓN DE DISEÑO, que es lo que hace que esto no sea otro arbitrario:
 * la app **no tiene** la hora de la operación (`fecha` es `YYYY-MM-DD`, sin hora,
 * por diseño) y no la va a inventar. Así que `secuencia` se asigna por orden de
 * captura y **se muestra editable**: quien sabe en qué orden ocurrieron de verdad
 * es el usuario, y la app no puede adivinarlo mejor que un UUID — pero sí puede
 * dejar de fingir que lo sabe.
 *
 * NUMERACIÓN: contador global monótono sobre todo el documento, no por día.
 * Nunca se reutiliza, así que insertar, borrar o cambiar de fecha una operación
 * no obliga a renumerar nada y no puede haber empates. La UI muestra el rango
 * dentro del día ("2 de 3"), que es lo que el usuario entiende.
 */

import type { Operacion } from './tipos'
import { compararPorFecha } from './fechas'

/** Lo que hace falta para ordenar: no exige una `Operacion` completa. */
export interface Ordenable {
  id: string
  fecha: string
  secuencia?: number
}

/**
 * Asigna `secuencia` conservando EXACTAMENTE el orden efectivo actual.
 *
 * Es la migración, y su propiedad esencial es que **no mueve nada**: se ordena
 * con el mismo comparador que rige hoy —que ya cae al `id` cuando falta la
 * secuencia— y se numera en ese orden. Migrar no cambia ninguna ganancia ya
 * declarada; solo hace explícito lo que ya estaba decidido.
 *
 * Si TODAS las operaciones ya tienen secuencia se devuelve el arreglo tal cual:
 * un orden que el usuario reordenó a mano no se toca.
 */
export function asignarSecuencias<T extends Ordenable>(operaciones: readonly T[]): T[] {
  if (operaciones.length === 0) return [...operaciones]
  if (operaciones.every((o) => typeof o.secuencia === 'number')) return [...operaciones]

  const orden = new Map<string, number>()
  ;[...operaciones].sort(compararPorFecha).forEach((o, i) => orden.set(o.id, i + 1))
  return operaciones.map((o) => ({ ...o, secuencia: orden.get(o.id)! }))
}

/** Siguiente valor del contador global: lo nuevo se captura al final. */
export function siguienteSecuencia(operaciones: readonly Ordenable[]): number {
  let max = 0
  for (const o of operaciones) if (typeof o.secuencia === 'number' && o.secuencia > max) max = o.secuencia
  return max + 1
}

/**
 * Las operaciones que comparten activo y día: son las únicas cuyo orden mueve
 * un número, porque el costeo camina cada activo por separado.
 */
export function mismoDiaYActivo(operaciones: readonly Operacion[], op: Operacion): Operacion[] {
  return operaciones
    .filter((o) => o.activoId === op.activoId && o.fecha === op.fecha)
    .sort(compararPorFecha)
}

/**
 * Sube (`-1`) o baja (`+1`) una operación dentro de su día y su activo,
 * intercambiando la `secuencia` con la vecina. En los extremos no hace nada.
 */
export function moverEnSuDia(operaciones: readonly Operacion[], operacionId: string, delta: -1 | 1): Operacion[] {
  const objetivo = operaciones.find((o) => o.id === operacionId)
  if (!objetivo) return [...operaciones]

  const grupo = mismoDiaYActivo(operaciones, objetivo)
  const i = grupo.findIndex((o) => o.id === operacionId)
  const j = i + delta
  if (i < 0 || j < 0 || j >= grupo.length) return [...operaciones]

  const a = grupo[i]!
  const b = grupo[j]!
  // Si alguna no tiene secuencia todavía, el intercambio no significaría nada.
  if (typeof a.secuencia !== 'number' || typeof b.secuencia !== 'number') return [...operaciones]

  return operaciones.map((o) =>
    o.id === a.id ? { ...o, secuencia: b.secuencia } : o.id === b.id ? { ...o, secuencia: a.secuencia } : o,
  )
}
