/**
 * Reparto del valor del portafolio: cuánto pesa cada posición y cuánto pesa
 * cada grupo de una dimensión (clase, sector, geografía, etiqueta).
 *
 * Existe para que esa fórmula viva en UN solo lugar. Antes estaba escrita dos
 * veces —dentro de `calcularPortafolio` y dentro de `calcularDiversificacion`—
 * y daban el mismo número por coincidencia de mantenimiento, no por diseño
 * (handoff §13.3). Cualquier consumidor nuevo entra por aquí.
 *
 * Las tres reglas del reparto, en un solo sitio:
 * 1. Solo participan las posiciones ABIERTAS: una cerrada no pesa.
 * 2. La base es la suma SIN redondear de `valorBase`.
 * 3. El % se calcula sobre valores sin redondear y se redondea al final, a 2.
 */

import type { Posicion } from './portafolio'
import { redondear } from './dinero'

export interface Rebanada {
  /** Clave estable de la dimensión ('technology', 'mexico', id de etiqueta…). */
  clave: string
  /** Nombre listo para mostrar cuando la clave no es traducible (etiquetas). */
  nombre?: string
  valor: number
  pct: number
}

export const SIN_CLASIFICAR = 'sin_clasificar'

/** Regla 1: el reparto es de lo que sigue abierto. */
export function abiertasDe(posiciones: Posicion[]): Posicion[] {
  return posiciones.filter((p) => p.cantidad > 0)
}

/** Regla 2: la base de todos los porcentajes, sin redondear. */
export function valorRepartible(abiertas: Posicion[]): number {
  return abiertas.reduce((s, p) => s + (p.valorBase ?? 0), 0)
}

/** Regla 3: % sobre el total. Cero —nunca NaN— cuando no hay nada que repartir. */
export function pctDelTotal(valor: number, total: number): number {
  return total > 0 ? redondear((valor / total) * 100, 2) : 0
}

/**
 * Agrupa el valor de las posiciones abiertas por la clave que devuelva `claveDe`.
 * Si devuelve una lista vacía, la posición cae en `SIN_CLASIFICAR`; si devuelve
 * varias claves, su valor cuenta completo en cada una (caso de las etiquetas,
 * donde los porcentajes no suman 100 a propósito).
 */
export function agruparPorValor(
  abiertas: Posicion[],
  total: number,
  claveDe: (p: Posicion) => string[] | string,
): Rebanada[] {
  const montos = new Map<string, number>()
  for (const p of abiertas) {
    const claves = claveDe(p)
    const lista = Array.isArray(claves) ? (claves.length > 0 ? claves : [SIN_CLASIFICAR]) : [claves]
    for (const clave of lista) {
      montos.set(clave, (montos.get(clave) ?? 0) + (p.valorBase ?? 0))
    }
  }
  return [...montos.entries()]
    .map(([clave, valor]) => ({
      clave,
      valor: redondear(valor, 2),
      pct: pctDelTotal(valor, total),
    }))
    .sort((a, b) => b.valor - a.valor)
}

/** La dimensión "clase de activo", que es la que consumen las dos vías. */
export function asignacionPorClase(abiertas: Posicion[], total: number): Rebanada[] {
  return agruparPorValor(abiertas, total, (p) => p.activo.clase)
}
