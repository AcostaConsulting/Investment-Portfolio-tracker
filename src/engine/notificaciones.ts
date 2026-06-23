/**
 * Detección de transiciones de alertas de precio: qué alertas pasaron de
 * NO-disparada a disparada entre dos evaluaciones consecutivas.
 *
 * Motor puro: no toca el SO ni el DOM. El disparo de la notificación nativa
 * (efecto de plataforma) vive fuera del engine, en la capa de UI.
 */

import type { AlertaDisparada } from './alertas'

/**
 * Clave estable de una alerta disparada: la config más el lado (piso/techo).
 * Una misma alerta puede tener piso y techo; cada lado se rastrea aparte.
 */
export function claveAlerta(a: AlertaDisparada): string {
  return `${a.configId}:${a.tipo}`
}

export interface CambioAlertas {
  /** Las que se acaban de disparar (no estaban en el conjunto previo). */
  nuevas: AlertaDisparada[]
  /** Conjunto de claves disparadas AHORA; alimenta la siguiente comparación. */
  clavesActuales: Set<string>
}

/**
 * Dadas las claves ya notificadas y las alertas disparadas en este momento,
 * regresa las que pasaron de no-disparada a disparada y el nuevo conjunto de
 * claves vigentes.
 *
 * - Una alerta que SIGUE disparada no vuelve a notificarse (evita spam en cada
 *   refresh de precios).
 * - Una alerta que se apaga sale del conjunto; si vuelve a dispararse más tarde,
 *   se notifica de nuevo.
 */
export function detectarNuevasAlertas(
  yaNotificadas: ReadonlySet<string>,
  disparadas: readonly AlertaDisparada[],
): CambioAlertas {
  const clavesActuales = new Set<string>()
  const nuevas: AlertaDisparada[] = []
  for (const alerta of disparadas) {
    const clave = claveAlerta(alerta)
    if (clavesActuales.has(clave)) continue // defensivo: sin duplicados
    clavesActuales.add(clave)
    if (!yaNotificadas.has(clave)) nuevas.push(alerta)
  }
  return { nuevas, clavesActuales }
}
