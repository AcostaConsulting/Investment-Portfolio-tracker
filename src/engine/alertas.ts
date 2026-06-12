/**
 * Alertas de precio: el usuario fija un piso y/o techo por activo
 * (en la moneda del activo) y el motor evalúa contra el precio vigente.
 */

import type { Posicion } from './portafolio'
import type { PrecioActual } from './tipos'

export interface ConfigAlerta {
  id: string
  activoId: string
  /** Avisar si el precio cae a este nivel o menos. */
  precioMin?: number
  /** Avisar si el precio sube a este nivel o más. */
  precioMax?: number
  activa: boolean
}

export interface AlertaDisparada {
  configId: string
  activoId: string
  simbolo: string
  tipo: 'min' | 'max'
  precioActual: number
  umbral: number
  moneda: string
}

/**
 * Evalúa todas las alertas activas contra los precios vigentes.
 * Las posiciones aportan el activo (símbolo); los precios, el dato actual.
 */
export function evaluarAlertas(
  posiciones: Posicion[],
  config: ConfigAlerta[],
  precios: Record<string, PrecioActual>,
): AlertaDisparada[] {
  const disparadas: AlertaDisparada[] = []
  const porActivo = new Map(posiciones.map((p) => [p.activo.id, p.activo]))

  for (const alerta of config) {
    if (!alerta.activa) continue
    const activo = porActivo.get(alerta.activoId)
    const precio = precios[alerta.activoId]
    if (!activo || !precio) continue

    if (alerta.precioMin !== undefined && precio.precio <= alerta.precioMin) {
      disparadas.push({
        configId: alerta.id,
        activoId: alerta.activoId,
        simbolo: activo.simbolo,
        tipo: 'min',
        precioActual: precio.precio,
        umbral: alerta.precioMin,
        moneda: precio.moneda,
      })
    }
    if (alerta.precioMax !== undefined && precio.precio >= alerta.precioMax) {
      disparadas.push({
        configId: alerta.id,
        activoId: alerta.activoId,
        simbolo: activo.simbolo,
        tipo: 'max',
        precioActual: precio.precio,
        umbral: alerta.precioMax,
        moneda: precio.moneda,
      })
    }
  }
  return disparadas
}
