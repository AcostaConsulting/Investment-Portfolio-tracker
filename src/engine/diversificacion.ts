/**
 * Diversificación del portafolio en cuatro dimensiones:
 * clase, sector, geografía y etiqueta. Puro: posiciones → rebanadas.
 *
 * El reparto en sí (qué posiciones participan, la base y el redondeo del %)
 * vive en `asignacion.ts`, compartido con `calcularPortafolio` — ver §13.3.
 * Aquí solo se decide QUÉ clave le toca a cada posición en cada dimensión.
 */

import type { Posicion } from './portafolio'
import type { Etiqueta } from '../state/documento'
import { redondear } from './dinero'
import {
  abiertasDe,
  agruparPorValor,
  asignacionPorClase,
  valorRepartible,
  SIN_CLASIFICAR,
  type Rebanada,
} from './asignacion'

// Re-exportados para no obligar a los consumidores a saber que se mudaron.
export { SIN_CLASIFICAR, type Rebanada }

export interface VistaDiversificacion {
  /** Valor total de las posiciones abiertas (base de los %). */
  valorTotal: number
  porClase: Rebanada[]
  porSector: Rebanada[]
  porGeografia: Rebanada[]
  porEtiqueta: Rebanada[]
}

export function calcularDiversificacion(
  posiciones: Posicion[],
  etiquetas: Etiqueta[],
): VistaDiversificacion {
  const abiertas = abiertasDe(posiciones)
  const total = valorRepartible(abiertas)

  const porEtiqueta = agruparPorValor(abiertas, total, (p) => p.activo.etiquetaIds ?? []).map((r) => ({
    ...r,
    nombre: etiquetas.find((e) => e.id === r.clave)?.nombre ?? r.clave,
  }))

  return {
    valorTotal: redondear(total, 2),
    porClase: asignacionPorClase(abiertas, total),
    // La renta fija no usa sectores (GICS/cripto); se agrupa bajo su propia clase
    // en vez de caer en "sin clasificar".
    porSector: agruparPorValor(abiertas, total, (p) =>
      p.activo.sector ?? (p.activo.clase === 'renta_fija' ? 'renta_fija' : SIN_CLASIFICAR),
    ),
    porGeografia: agruparPorValor(abiertas, total, (p) => p.activo.geografia ?? SIN_CLASIFICAR),
    porEtiqueta: porEtiqueta.filter((r) => r.clave !== SIN_CLASIFICAR),
  }
}
