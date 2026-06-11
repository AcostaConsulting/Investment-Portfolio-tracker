/** Hooks derivados: cálculo del portafolio y alertas a partir del documento. */

import { useMemo } from 'react'
import { useApp } from './store'
import { calcularPortafolio, type ResultadoPortafolio } from '../engine/portafolio'
import { alertasVencimiento, type AlertaVencimiento } from '../engine/rentaFija'
import { calcularDiversificacion, type VistaDiversificacion } from '../engine/diversificacion'
import type { ContextoValuacion } from '../engine/tipos'
import { hoyIso, sumarDias } from '../engine/fechas'

export function useContextoValuacion(): ContextoValuacion {
  const doc = useApp((s) => s.doc)
  return useMemo(
    () => ({
      monedaBase: doc.ajustes.monedaBase,
      hoy: hoyIso(),
      precios: doc.precios,
      tiposCambio: doc.tiposCambio,
      udiActual: doc.ajustes.udiActual,
      tasaIsrAnual: doc.ajustes.tasaIsrAnual,
    }),
    [doc.ajustes.monedaBase, doc.precios, doc.tiposCambio, doc.ajustes.udiActual, doc.ajustes.tasaIsrAnual],
  )
}

export function usePortafolio(): ResultadoPortafolio {
  const doc = useApp((s) => s.doc)
  const contexto = useContextoValuacion()
  return useMemo(
    () => calcularPortafolio(doc.activos, doc.operaciones, contexto),
    [doc.activos, doc.operaciones, contexto],
  )
}

export function useAlertasVencimiento(): AlertaVencimiento[] {
  const doc = useApp((s) => s.doc)
  return useMemo(
    () => alertasVencimiento(doc.activos, hoyIso(), doc.ajustes.diasAlertaVencimiento),
    [doc.activos, doc.ajustes.diasAlertaVencimiento],
  )
}

export function useDiversificacion(): VistaDiversificacion {
  const { posiciones } = usePortafolio()
  const etiquetas = useApp((s) => s.doc.etiquetas)
  return useMemo(() => calcularDiversificacion(posiciones, etiquetas), [posiciones, etiquetas])
}

/**
 * Cambio % del portafolio en los últimos `dias`, usando los snapshots diarios.
 * undefined si todavía no hay historia suficiente — la UI lo dice tal cual.
 */
export function useCambioPortafolio(dias: number): number | undefined {
  const historico = useApp((s) => s.doc.historico)
  return useMemo(() => {
    if (historico.length < 2) return undefined
    const corte = sumarDias(hoyIso(), -dias)
    // El punto más reciente cuyo fecha sea ≤ corte; si no existe, no hay historia.
    let referencia
    for (const punto of historico) {
      if (punto.fecha <= corte) referencia = punto
      else break
    }
    if (!referencia || referencia.valor <= 0) return undefined
    const ultimo = historico[historico.length - 1]!
    return ((ultimo.valor - referencia.valor) / referencia.valor) * 100
  }, [historico, dias])
}
