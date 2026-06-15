/**
 * Consultoría fiscal 1:1 — precio con descuento por plan.
 * El cobro real ocurre fuera de la app (Odoo); aquí solo se muestra.
 *
 * El precio base está en MXN (la consultoría es un servicio local mexicano).
 */

import type { Plan } from '../licencias/planes'
import { DESCUENTO_CONSULTORIA } from './planes'
import { redondear } from './dinero'

export const PRECIO_BASE_CONSULTORIA_MXN = 800

export interface PrecioConsultoria {
  precioBaseMxn: number
  descuentoPct: number
  precioFinalMxn: number
  ahorroMxn: number
}

export function obtenerPrecioConsultoria(plan: Plan): PrecioConsultoria {
  const descuentoPct = DESCUENTO_CONSULTORIA[plan]
  const precioFinalMxn = redondear(PRECIO_BASE_CONSULTORIA_MXN * (1 - descuentoPct / 100), 2)
  return {
    precioBaseMxn: PRECIO_BASE_CONSULTORIA_MXN,
    descuentoPct,
    precioFinalMxn,
    ahorroMxn: redondear(PRECIO_BASE_CONSULTORIA_MXN - precioFinalMxn, 2),
  }
}
