/**
 * Liquidez del portafolio: qué parte del valor está en activos que el
 * usuario marcó como líquidos (default: todo activo es líquido salvo
 * que se marque lo contrario).
 */

import type { Posicion } from './portafolio'
import { redondear } from './dinero'

export const UMBRAL_LIQUIDEZ_DEFAULT = 10

export interface AnalisisLiquidez {
  valorLiquido: number
  valorIliquido: number
  /** % líquido sobre el total (0 si el portafolio está vacío). */
  ratioPct: number
  umbralPct: number
  /** true si el ratio quedó por debajo del umbral configurado. */
  debajoDelUmbral: boolean
}

export function calcularLiquidez(posiciones: Posicion[], umbralPct = UMBRAL_LIQUIDEZ_DEFAULT): AnalisisLiquidez {
  const abiertas = posiciones.filter((p) => p.cantidad > 0)
  let liquido = 0
  let iliquido = 0
  for (const p of abiertas) {
    const valor = p.valorBase ?? 0
    if (p.activo.liquido === false) iliquido += valor
    else liquido += valor
  }
  const total = liquido + iliquido
  const ratioPct = total > 0 ? redondear((liquido / total) * 100, 2) : 0
  return {
    valorLiquido: redondear(liquido, 2),
    valorIliquido: redondear(iliquido, 2),
    ratioPct,
    umbralPct,
    debajoDelUmbral: total > 0 && ratioPct < umbralPct,
  }
}
