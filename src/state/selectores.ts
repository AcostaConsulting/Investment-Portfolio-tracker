/** Hooks derivados: cálculo del portafolio y alertas a partir del documento. */

import { useMemo } from 'react'
import { useApp } from './store'
import { calcularPortafolio, type ResultadoPortafolio } from '../engine/portafolio'
import { alertasVencimiento, type AlertaVencimiento } from '../engine/rentaFija'
import type { ContextoValuacion } from '../engine/tipos'
import { hoyIso } from '../engine/fechas'

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
