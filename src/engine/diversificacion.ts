/**
 * Diversificación del portafolio en cuatro dimensiones:
 * clase, sector, geografía y etiqueta. Puro: posiciones → rebanadas.
 */

import type { Posicion } from './portafolio'
import type { Etiqueta } from '../state/documento'
import { redondear } from './dinero'

export interface Rebanada {
  /** Clave estable de la dimensión ('technology', 'mexico', id de etiqueta…). */
  clave: string
  /** Nombre listo para mostrar cuando la clave no es traducible (etiquetas). */
  nombre?: string
  valor: number
  pct: number
}

export interface VistaDiversificacion {
  /** Valor total de las posiciones abiertas (base de los %). */
  valorTotal: number
  porClase: Rebanada[]
  porSector: Rebanada[]
  porGeografia: Rebanada[]
  porEtiqueta: Rebanada[]
}

export const SIN_CLASIFICAR = 'sin_clasificar'

function agrupar(
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
      pct: total > 0 ? redondear((valor / total) * 100, 2) : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
}

export function calcularDiversificacion(
  posiciones: Posicion[],
  etiquetas: Etiqueta[],
): VistaDiversificacion {
  const abiertas = posiciones.filter((p) => p.cantidad > 0)
  const total = abiertas.reduce((s, p) => s + (p.valorBase ?? 0), 0)

  const porEtiqueta = agrupar(abiertas, total, (p) => p.activo.etiquetaIds ?? []).map((r) => ({
    ...r,
    nombre: etiquetas.find((e) => e.id === r.clave)?.nombre ?? r.clave,
  }))

  return {
    valorTotal: redondear(total, 2),
    porClase: agrupar(abiertas, total, (p) => p.activo.clase),
    porSector: agrupar(abiertas, total, (p) => p.activo.sector ?? SIN_CLASIFICAR),
    porGeografia: agrupar(abiertas, total, (p) => p.activo.geografia ?? SIN_CLASIFICAR),
    porEtiqueta: porEtiqueta.filter((r) => r.clave !== SIN_CLASIFICAR),
  }
}
