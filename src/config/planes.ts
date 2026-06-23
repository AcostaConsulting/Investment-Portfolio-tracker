/** Configuración comercial: precios de referencia y URLs oficiales. */

import type { Plan } from '../licencias/planes'

/**
 * Tipo de cambio SOLO para mostrar precios aproximados en MXN.
 * No interviene en ningún cálculo del portafolio.
 */
export const USD_MXN_DISPLAY = 18.5

export const URLS_GUMROAD: Record<Exclude<Plan, 'free'>, string> = {
  pro: 'https://acostafconsulting.gumroad.com/l/portfoliotrackerpro',
  premium: 'https://acostafconsulting.gumroad.com/l/portfoliotrackerpremium',
  lifetime: 'https://acostafconsulting.gumroad.com/l/portfoliotrackerlifetime',
}

export const URL_CONSULTORIA = 'https://acostaconsulting.odoo.com/appointment/3'
export const URL_CONTACTO = 'https://franscisco-acosta.odoo.com/contactus'
