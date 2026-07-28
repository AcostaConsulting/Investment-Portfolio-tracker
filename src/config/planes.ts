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
export const URL_CONTACTO = 'https://acostaconsulting.odoo.com/contactus'

/** Serie de tutoriales T1–T12 en YouTube. El host va en la allowlist de lib/externo.ts. */
export const URL_PLAYLIST_VIDEOS = 'https://www.youtube.com/playlist?list=PLFxrNvaOljbE'

/**
 * Los 12 videos de la serie, en orden. `llave` apunta al título traducido en
 * i18n (`ayuda.<llave>`).
 *
 * Las URLs van sin `&list=` ni `&index=` a propósito: los índices de la playlist
 * venían inconsistentes en la fuente (dos videos distintos con index=9) y habrían
 * abierto la posición equivocada. Cada tarjeta abre su video y ya; para ver la
 * serie seguida está el botón de la playlist.
 */
export const VIDEOS_TUTORIALES = [
  { llave: 'video1', url: 'https://www.youtube.com/watch?v=FOF40Zo5TFQ' },
  { llave: 'video2', url: 'https://www.youtube.com/watch?v=JfphkSUfVfU' },
  { llave: 'video3', url: 'https://www.youtube.com/watch?v=5sDhq669e7U' },
  { llave: 'video4', url: 'https://www.youtube.com/watch?v=eH2UpTTyDas' },
  { llave: 'video5', url: 'https://www.youtube.com/watch?v=FFVRR5TYjhE' },
  { llave: 'video6', url: 'https://www.youtube.com/watch?v=TsGlWTLcAlk' },
  { llave: 'video7', url: 'https://www.youtube.com/watch?v=Z9-RIrhIqtI' },
  { llave: 'video8', url: 'https://www.youtube.com/watch?v=Fb2IdAGAPhw' },
  { llave: 'video9', url: 'https://www.youtube.com/watch?v=Ni2o8-Y_vJU' },
  { llave: 'video10', url: 'https://www.youtube.com/watch?v=MSDe8gXvb7A' },
  { llave: 'video11', url: 'https://www.youtube.com/watch?v=RXvIW6G8EuU' },
  { llave: 'video12', url: 'https://www.youtube.com/watch?v=bG7642930uQ' },
] as const
