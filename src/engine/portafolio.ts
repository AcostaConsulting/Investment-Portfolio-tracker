/**
 * Motor de portafolio: a partir de operaciones produce posiciones con costo
 * promedio ponderado, P&L realizado/no realizado, ingresos y asignación.
 *
 * Todo el dinero se lleva en DOS pistas:
 * - base: moneda base del usuario, convertida con el tipo de cambio capturado
 *   en cada operación (costo histórico) o el vigente (valuación).
 * - nativa: moneda del activo, solo cuando todas las operaciones del activo
 *   se capturaron en ella (si no, `monedaMixta` y la UI muestra solo base).
 */

import type { Activo, Advertencia, ContextoValuacion, Operacion } from './tipos'
import { OPERACIONES_EFECTIVO, OPERACIONES_EN_ESPECIE } from './tipos'
import { compararPorFecha } from './fechas'
import { aMonedaBase, redondear } from './dinero'
import { valuarRentaFija, type ValuacionRentaFija } from './rentaFija'

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

interface Acumulador {
  cantidad: number
  costoBase: number
  costoNativo: number
  monedaMixta: boolean
  realizadoBase: number
  ingresosBase: number
  comisionesBase: number
}

function acumuladorVacio(): Acumulador {
  return {
    cantidad: 0,
    costoBase: 0,
    costoNativo: 0,
    monedaMixta: false,
    realizadoBase: 0,
    ingresosBase: 0,
    comisionesBase: 0,
  }
}

/**
 * Procesa las operaciones de un activo en orden cronológico.
 * Exportada por separado para poder probarla de forma aislada.
 */
export function acumularOperaciones(
  activo: Activo,
  operaciones: Operacion[],
  advertencias: Advertencia[],
): Acumulador {
  const acc = acumuladorVacio()
  const ordenadas = [...operaciones].sort(compararPorFecha)

  for (const op of ordenadas) {
    let tc = op.tipoCambio
    if (!(tc > 0)) {
      advertencias.push({ codigo: 'sin_tipo_cambio', activoId: activo.id, operacionId: op.id })
      tc = 1
    }
    const esMonedaNativa = op.moneda === activo.moneda
    if (!esMonedaNativa) acc.monedaMixta = true

    const comision = op.comision ?? 0
    const comisionBase = comision * tc
    acc.comisionesBase += comisionBase
    const importeBase = op.cantidad * op.precioUnitario * tc

    switch (op.tipo) {
      case 'compra': {
        acc.cantidad += op.cantidad
        acc.costoBase += importeBase + comisionBase
        if (esMonedaNativa) acc.costoNativo += op.cantidad * op.precioUnitario + comision
        break
      }
      case 'venta': {
        let vendida = op.cantidad
        if (vendida > acc.cantidad + 1e-12) {
          advertencias.push({
            codigo: 'venta_excede_tenencia',
            activoId: activo.id,
            operacionId: op.id,
            detalle: `venta de ${op.cantidad}, tenencia ${acc.cantidad}`,
          })
          vendida = acc.cantidad
        }
        if (vendida <= 0) break
        const ppBase = acc.costoBase / acc.cantidad
        const ppNativo = acc.costoNativo / acc.cantidad
        acc.realizadoBase += vendida * op.precioUnitario * tc - comisionBase - vendida * ppBase
        acc.costoBase -= vendida * ppBase
        acc.costoNativo -= vendida * ppNativo
        acc.cantidad -= vendida
        break
      }
      case 'ajuste': {
        if (op.cantidad >= 0) {
          // Ej. split o corrección al alza: entra cantidad al costo capturado (usualmente 0).
          acc.cantidad += op.cantidad
          acc.costoBase += importeBase
          if (esMonedaNativa) acc.costoNativo += op.cantidad * op.precioUnitario
        } else {
          // Retiro sin P&L: reduce cantidad y costo proporcionalmente.
          let retiro = -op.cantidad
          if (retiro > acc.cantidad + 1e-12) {
            advertencias.push({
              codigo: 'ajuste_excede_tenencia',
              activoId: activo.id,
              operacionId: op.id,
            })
            retiro = acc.cantidad
          }
          if (acc.cantidad > 0) {
            const proporcion = retiro / acc.cantidad
            acc.costoBase -= acc.costoBase * proporcion
            acc.costoNativo -= acc.costoNativo * proporcion
            acc.cantidad -= retiro
          }
        }
        break
      }
      default: {
        if (OPERACIONES_EFECTIVO.has(op.tipo)) {
          // Dividendo/interés: efectivo, no toca la cantidad.
          acc.ingresosBase += importeBase - comisionBase
        } else if (OPERACIONES_EN_ESPECIE.has(op.tipo)) {
          // Staking/airdrop/recompensa: entra cantidad a valor de mercado capturado;
          // ese valor es a la vez ingreso y costo (base gravable y de P&L futura).
          acc.cantidad += op.cantidad
          acc.costoBase += importeBase
          if (esMonedaNativa) acc.costoNativo += op.cantidad * op.precioUnitario
          acc.ingresosBase += importeBase - comisionBase
        }
        break
      }
    }
  }

  // Limpia residuos de punto flotante en posiciones cerradas.
  if (Math.abs(acc.cantidad) < 1e-9) {
    acc.cantidad = 0
    acc.costoBase = 0
    acc.costoNativo = 0
  }
  return acc
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
  let valorTotal = 0
  let costoTotal = 0
  let pnlRealizado = 0
  let ingresos = 0
  let comisiones = 0
  const porClase: Record<string, { valor: number; pct: number }> = {}

  for (const activo of activos) {
    const ops = porActivo.get(activo.id) ?? []
    const acc = acumularOperaciones(activo, ops, advertencias)
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

      valuarPosicion(posicion, acc, contexto, advertencias)
      valorTotal += posicion.valorBase ?? 0
      costoTotal += acc.costoBase

      const clase = activo.clase
      const entrada = (porClase[clase] ??= { valor: 0, pct: 0 })
      entrada.valor += posicion.valorBase ?? 0
    }

    posiciones.push(posicion)
  }

  for (const entrada of Object.values(porClase)) {
    entrada.pct = valorTotal > 0 ? redondear((entrada.valor / valorTotal) * 100, 2) : 0
    entrada.valor = redondear(entrada.valor, 2)
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
  acc: Acumulador,
  contexto: ContextoValuacion,
  advertencias: Advertencia[],
): void {
  const { activo } = posicion

  // Renta fija: el valor sale del devengo, no de un precio de mercado.
  if (activo.clase === 'renta_fija' && activo.rentaFija) {
    const valuacion = valuarRentaFija(
      activo.rentaFija,
      { cantidad: acc.cantidad, costoNativo: acc.monedaMixta ? acc.costoBase : acc.costoNativo },
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
