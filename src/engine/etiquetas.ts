/**
 * Etiquetas personalizadas: límite por plan y distribución del portafolio.
 * Free/Pro: 1 etiqueta por activo. Premium/Lifetime: sin límite.
 */

import { tieneCapacidad, type Plan } from '../licencias/planes'
import type { Posicion } from './portafolio'
import { redondear } from './dinero'

export const MAX_ETIQUETAS_BASICO = 1

export function puedeAgregarEtiqueta(plan: Plan, etiquetasActuales: number): boolean {
  if (tieneCapacidad(plan, 'etiquetasIlimitadas')) return true
  return etiquetasActuales < MAX_ETIQUETAS_BASICO
}

export interface DistribucionEtiqueta {
  etiquetaId: string
  /** Valor en moneda base de las posiciones abiertas con la etiqueta. */
  valor: number
  /** % sobre el valor total de las posiciones abiertas. */
  pct: number
  cantidadActivos: number
}

export function calcularDistribucionEtiquetas(
  posiciones: Posicion[],
  etiquetaId: string,
): DistribucionEtiqueta {
  const abiertas = posiciones.filter((p) => p.cantidad > 0)
  const total = abiertas.reduce((s, p) => s + (p.valorBase ?? 0), 0)
  const conEtiqueta = abiertas.filter((p) => p.activo.etiquetaIds?.includes(etiquetaId))
  const valor = conEtiqueta.reduce((s, p) => s + (p.valorBase ?? 0), 0)
  return {
    etiquetaId,
    valor: redondear(valor, 2),
    pct: total > 0 ? redondear((valor / total) * 100, 2) : 0,
    cantidadActivos: conEtiqueta.length,
  }
}
