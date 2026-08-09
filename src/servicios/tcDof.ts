/**
 * Acceso al tipo de cambio con efecto fiscal (el del DOF).
 *
 * Une el motor puro `engine/tcDof.ts` con la serie empaquetada. La serie son
 * ~82 KB, así que se carga con `import()` dinámico: no entra al bundle
 * inicial y sólo se paga al abrir el formulario de una operación en divisa,
 * igual que exceljs (handoff §13.2).
 *
 * 🔑 Para el caso principal —base MXN, operación en USD— esto NO toca la red:
 * la serie viene con la app. La regla fiscal del DOF funciona sin internet,
 * que es la promesa del producto (§7).
 *
 * Alcance deliberado: sólo USD sobre base MXN. El TC del DOF es una regla
 * fiscal mexicana y Banxico no publica un TC del DOF directo para otras
 * monedas; la norma manda cruzar vía dólar, y eso es otra decisión (§19.9).
 * Fuera de ese caso este módulo dice `undefined` y el llamador usa la fuente
 * de siempre.
 */

import { crearTablaFix, tcDofAplicable, type TablaFix, type TcDof } from '../engine/tcDof'

export const MONEDA_DOF = 'USD'
export const BASE_DOF = 'MXN'

let tablaPromesa: Promise<TablaFix> | null = null

/** Carga la serie una sola vez por sesión y la deja indexada. */
function tabla(): Promise<TablaFix> {
  tablaPromesa ??= import('../datos/tcDofSerie').then((m) => crearTablaFix(m.SERIE_FIX))
  return tablaPromesa
}

/** true si a este par de monedas le aplica la regla del DOF. */
export function aplicaDof(de: string, a: string): boolean {
  return de === MONEDA_DOF && a === BASE_DOF
}

/**
 * TC del DOF aplicable a una operación de esa fecha, o `undefined` si no
 * aplica (otro par de monedas) o si la serie empaquetada no llega hasta ahí
 * —lo que pasa con fechas posteriores al último release—. En ese caso quien
 * llama decide: pedir a la red o dejar que el usuario lo escriba.
 */
export async function tcDofHistorico(
  fechaIso: string,
  de: string,
  a: string,
): Promise<TcDof | undefined> {
  if (!aplicaDof(de, a)) return undefined
  return tcDofAplicable(await tabla(), fechaIso)
}
