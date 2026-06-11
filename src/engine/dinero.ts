/** Redondeo y conversión de moneda. Puro, sin estado. */

/** Redondea a `decimales` evitando el sesgo de coma flotante (0.1+0.2). */
export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales
  // EPSILON corrige casos tipo 1.005 que el floating point deja en 1.00499...
  return Math.round((valor + Number.EPSILON) * factor) / factor
}

/**
 * Convierte un monto a moneda base usando un mapa de tipos de cambio
 * (moneda → unidades de base). Regresa `undefined` si no hay tipo de cambio,
 * para que quien llama decida cómo advertirlo — el motor nunca inventa un 1:1.
 */
export function aMonedaBase(
  monto: number,
  moneda: string,
  monedaBase: string,
  tiposCambio: Record<string, number>,
): number | undefined {
  if (moneda === monedaBase) return monto
  const tc = tiposCambio[moneda]
  if (tc === undefined || !(tc > 0)) return undefined
  return monto * tc
}
