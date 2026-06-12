/**
 * Consultoría fiscal 1:1 — precio con descuento por plan.
 * El cobro real ocurre fuera de la app (Odoo); aquí solo se muestra.
 */

import type { Plan } from '../licencias/planes'
import { DESCUENTO_CONSULTORIA } from './planes'
import { redondear } from './dinero'

export const PRECIO_BASE_CONSULTORIA_USD = 149

export interface PrecioConsultoria {
  precioBaseUsd: number
  descuentoPct: number
  precioFinalUsd: number
  ahorroUsd: number
}

export function obtenerPrecioConsultoria(plan: Plan): PrecioConsultoria {
  const descuentoPct = DESCUENTO_CONSULTORIA[plan]
  const precioFinalUsd = redondear(PRECIO_BASE_CONSULTORIA_USD * (1 - descuentoPct / 100), 2)
  return {
    precioBaseUsd: PRECIO_BASE_CONSULTORIA_USD,
    descuentoPct,
    precioFinalUsd,
    ahorroUsd: redondear(PRECIO_BASE_CONSULTORIA_USD - precioFinalUsd, 2),
  }
}
