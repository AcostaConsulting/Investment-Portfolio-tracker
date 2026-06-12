/**
 * Metas financieras: valor objetivo total o por clase de activo.
 */

import type { Posicion } from './portafolio'
import type { ClaseActivo } from './tipos'
import { redondear } from './dinero'

export interface MetaFinanciera {
  id: string
  nombre: string
  /** Monto objetivo en moneda base. */
  objetivo: number
  /** Clase que cuenta para la meta; undefined = todo el portafolio. */
  clase?: ClaseActivo
  fechaLimite?: string
}

export interface ProgresoMeta {
  meta: MetaFinanciera
  valorActual: number
  /** 0–100, topado en 100. */
  pct: number
  alcanzada: boolean
}

export function evaluarMetas(posiciones: Posicion[], metas: MetaFinanciera[]): ProgresoMeta[] {
  const abiertas = posiciones.filter((p) => p.cantidad > 0)
  return metas.map((meta) => {
    const relevantes = meta.clase ? abiertas.filter((p) => p.activo.clase === meta.clase) : abiertas
    const valorActual = redondear(
      relevantes.reduce((s, p) => s + (p.valorBase ?? 0), 0),
      2,
    )
    const pct = meta.objetivo > 0 ? Math.min(100, redondear((valorActual / meta.objetivo) * 100, 2)) : 0
    return { meta, valorActual, pct, alcanzada: meta.objetivo > 0 && valorActual >= meta.objetivo }
  })
}
