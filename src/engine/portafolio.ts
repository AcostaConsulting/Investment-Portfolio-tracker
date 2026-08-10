/**
 * Motor de portafolio: a partir de operaciones produce posiciones con costo
 * promedio ponderado, P&L realizado/no realizado, ingresos y asignación.
 *
 * La fórmula del costo NO vive aquí: vive en `costeo.ts`, compartida con el
 * reporte fiscal (§16). Este módulo la consume y se ocupa de la valuación,
 * los totales y el reparto.
 *
 * Todo el dinero se lleva en DOS pistas:
 * - base: moneda base del usuario, convertida con el tipo de cambio capturado
 *   en cada operación (costo histórico) o el vigente (valuación).
 * - nativa: moneda del activo, solo cuando todas las operaciones del activo
 *   se capturaron en ella (si no, `monedaMixta` y la UI muestra solo base).
 */

import type { Activo, Advertencia, ContextoValuacion, Operacion } from './tipos'
import { aMonedaBase, redondear } from './dinero'
import { valuarRentaFija, type ValuacionRentaFija } from './rentaFija'
import { abiertasDe, asignacionPorClase, pctDelTotal, valorRepartible } from './asignacion'
import { recorrerCosteo, type EstadoCosteo, type TramoPosicion } from './costeo'

export interface Posicion {
  activo: Activo
  cantidad: number
  /** Costo del holding vigente en moneda base (histórico). */
  costoBase: number
  /** Costo en la moneda del activo; undefined si hubo monedas mezcladas. */
  costoNativo?: number
  monedaMixta: boolean
  /** Costo promedio por unidad. */
  precioPromedioBase?: number
  precioPromedioNativo?: number
  /** P&L realizado acumulado (ventas) en base. */
  realizadoBase: number
  /** Dividendos, intereses y recompensas en especie valuadas, en base. */
  ingresosBase: number
  comisionesBase: number
  /** Valuación al contexto dado. */
  valorBase?: number
  valorNativo?: number
  pnlNoRealizadoBase?: number
  /** % sobre el costo vigente. */
  rendimientoPct?: number
  /** Precio de mercado vigente, en su propia moneda. No aplica a renta fija. */
  precioActual?: number
  monedaPrecioActual?: string
  /** % que representa esta posición sobre el valor total del portafolio. */
  pesoPct?: number
  /** Solo renta fija: detalle del devengo. */
  rentaFija?: ValuacionRentaFija
  /** true si el valor usa el costo porque no hay precio disponible. */
  sinPrecio: boolean
}

export interface TotalesPortafolio {
  monedaBase: string
  valorTotal: number
  costoTotal: number
  pnlNoRealizado: number
  pnlRealizado: number
  ingresos: number
  comisiones: number
  /** pnlNoRealizado + pnlRealizado + ingresos. */
  gananciaTotal: number
  /** % no realizado sobre el costo vigente. */
  rendimientoPct: number
  /** Asignación % por clase de activo sobre el valor total. */
  porClase: Record<string, { valor: number; pct: number }>
}

export interface ResultadoPortafolio {
  posiciones: Posicion[]
  totales: TotalesPortafolio
  advertencias: Advertencia[]
}

/** Calcula todas las posiciones y los totales del portafolio. */
export function calcularPortafolio(
  activos: Activo[],
  operaciones: Operacion[],
  contexto: ContextoValuacion,
): ResultadoPortafolio {
  const advertencias: Advertencia[] = []
  const porActivo = new Map<string, Operacion[]>()
  for (const op of operaciones) {
    const lista = porActivo.get(op.activoId)
    if (lista) lista.push(op)
    else porActivo.set(op.activoId, [op])
  }

  const posiciones: Posicion[] = []
  let costoTotal = 0
  let pnlRealizado = 0
  let ingresos = 0
  let comisiones = 0

  for (const activo of activos) {
    const ops = porActivo.get(activo.id) ?? []
    const { estado: acc, tramos } = recorrerCosteo(activo, ops, advertencias)
    pnlRealizado += acc.realizadoBase
    ingresos += acc.ingresosBase
    comisiones += acc.comisionesBase

    const tieneActividad = ops.length > 0
    if (!tieneActividad) continue

    const posicion: Posicion = {
      activo,
      cantidad: acc.cantidad,
      costoBase: redondear(acc.costoBase, 6),
      costoNativo: acc.monedaMixta ? undefined : redondear(acc.costoNativo, 6),
      monedaMixta: acc.monedaMixta,
      realizadoBase: redondear(acc.realizadoBase, 6),
      ingresosBase: redondear(acc.ingresosBase, 6),
      comisionesBase: redondear(acc.comisionesBase, 6),
      sinPrecio: false,
    }

    if (acc.cantidad > 0) {
      posicion.precioPromedioBase = acc.costoBase / acc.cantidad
      if (!acc.monedaMixta) posicion.precioPromedioNativo = acc.costoNativo / acc.cantidad

      valuarPosicion(posicion, acc, contexto, advertencias, tramos)
      costoTotal += acc.costoBase
    }

    posiciones.push(posicion)
  }

  // El reparto necesita el total, así que va en un segundo paso. La fórmula
  // —quién participa, la base y el redondeo— vive en `asignacion.ts` y es la
  // misma que usa `calcularDiversificacion` (§13.3).
  const abiertas = abiertasDe(posiciones)
  const valorTotal = valorRepartible(abiertas)

  const porClase: Record<string, { valor: number; pct: number }> = Object.fromEntries(
    asignacionPorClase(abiertas, valorTotal).map((r) => [r.clave, { valor: r.valor, pct: r.pct }]),
  )

  // El peso de cada posición es la misma cuenta, sin agrupar.
  for (const posicion of abiertas) {
    posicion.pesoPct = pctDelTotal(posicion.valorBase ?? 0, valorTotal)
  }

  const pnlNoRealizado = valorTotal - costoTotal
  const totales: TotalesPortafolio = {
    monedaBase: contexto.monedaBase,
    valorTotal: redondear(valorTotal, 2),
    costoTotal: redondear(costoTotal, 2),
    pnlNoRealizado: redondear(pnlNoRealizado, 2),
    pnlRealizado: redondear(pnlRealizado, 2),
    ingresos: redondear(ingresos, 2),
    comisiones: redondear(comisiones, 2),
    gananciaTotal: redondear(pnlNoRealizado + pnlRealizado + ingresos, 2),
    rendimientoPct: costoTotal > 0 ? redondear((pnlNoRealizado / costoTotal) * 100, 2) : 0,
    porClase,
  }

  return { posiciones, totales, advertencias }
}

function valuarPosicion(
  posicion: Posicion,
  acc: EstadoCosteo,
  contexto: ContextoValuacion,
  advertencias: Advertencia[],
  tramos?: readonly TramoPosicion[],
): void {
  const { activo } = posicion

  // Renta fija: el valor sale del devengo, no de un precio de mercado.
  if (activo.clase === 'renta_fija' && activo.rentaFija) {
    const valuacion = valuarRentaFija(
      activo.rentaFija,
      {
        cantidad: acc.cantidad,
        costoNativo: acc.monedaMixta ? acc.costoBase : acc.costoNativo,
        // Los tramos siguen la MISMA pista que el escalar de arriba.
        tramos: tramos?.map((t) => (acc.monedaMixta ? { ...t, costoNativo: t.costoBase } : t)),
      },
      contexto.hoy,
      { tasaIsrAnual: contexto.tasaIsrAnual, udiActual: contexto.udiActual },
    )
    posicion.rentaFija = valuacion
    const valorNativo = valuacion.valorNeto
    const valorBase = aMonedaBase(valorNativo, activo.moneda, contexto.monedaBase, contexto.tiposCambio)
    if (valorBase === undefined) {
      advertencias.push({ codigo: 'sin_tipo_cambio', activoId: activo.id })
      posicion.valorBase = acc.costoBase
      posicion.sinPrecio = true
    } else {
      posicion.valorBase = redondear(valorBase, 6)
      posicion.valorNativo = redondear(valorNativo, 6)
    }
    posicion.pnlNoRealizadoBase = redondear((posicion.valorBase ?? 0) - acc.costoBase, 6)
    posicion.rendimientoPct =
      acc.costoBase > 0 ? redondear((posicion.pnlNoRealizadoBase / acc.costoBase) * 100, 2) : 0
    return
  }

  // Acciones y cripto: precio vigente × tipo de cambio vigente.
  const precio = contexto.precios[activo.id]
  if (!precio) {
    advertencias.push({ codigo: 'sin_precio', activoId: activo.id })
    posicion.valorBase = acc.costoBase
    posicion.sinPrecio = true
    posicion.pnlNoRealizadoBase = 0
    posicion.rendimientoPct = 0
    return
  }

  // La renta fija se valúa por devengo, nunca por precio de mercado — aunque
  // llegue aquí por venir sin configuración de renta fija.
  if (activo.clase !== 'renta_fija') {
    posicion.precioActual = precio.precio
    posicion.monedaPrecioActual = precio.moneda
  }

  const valorEnMonedaPrecio = acc.cantidad * precio.precio
  const valorBase = aMonedaBase(valorEnMonedaPrecio, precio.moneda, contexto.monedaBase, contexto.tiposCambio)
  if (valorBase === undefined) {
    advertencias.push({ codigo: 'sin_tipo_cambio', activoId: activo.id })
    posicion.valorBase = acc.costoBase
    posicion.sinPrecio = true
    posicion.pnlNoRealizadoBase = 0
    posicion.rendimientoPct = 0
    return
  }

  posicion.valorBase = redondear(valorBase, 6)
  if (precio.moneda === activo.moneda) posicion.valorNativo = redondear(valorEnMonedaPrecio, 6)
  posicion.pnlNoRealizadoBase = redondear(valorBase - acc.costoBase, 6)
  posicion.rendimientoPct =
    acc.costoBase > 0 ? redondear((posicion.pnlNoRealizadoBase / acc.costoBase) * 100, 2) : 0
}
