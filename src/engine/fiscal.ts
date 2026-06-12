/**
 * Eventos fiscales DESCRIPTIVOS del año: qué pasó y por cuánto, para
 * platicarlo con un asesor. Este motor NO calcula impuestos.
 *
 * - Ventas: ganancia/pérdida de capital contra costo promedio ponderado
 *   (misma regla que el motor de portafolio).
 * - Renta fija: interés devengado en el año + retención ISR estimada
 *   (% anual sobre capital, prorrateado — reutiliza valuarRentaFija).
 * - Dividendos e intereses cobrados (operaciones).
 * - Ingresos en especie (staking/airdrop/recompensa) a valor de captura.
 *
 * Montos en moneda base usando el tipo de cambio de cada operación.
 */

import type { Activo, Operacion } from './tipos'
import { OPERACIONES_EFECTIVO, OPERACIONES_EN_ESPECIE } from './tipos'
import { compararPorFecha } from './fechas'
import { redondear } from './dinero'
import { valuarRentaFija } from './rentaFija'

export type TipoEventoFiscal =
  | 'venta_ganancia'
  | 'venta_perdida'
  | 'dividendo'
  | 'interes_cobrado'
  | 'ingreso_especie'
  | 'interes_devengado_rf'

export interface EventoFiscal {
  tipo: TipoEventoFiscal
  fecha: string
  activoId: string
  simbolo: string
  /** Monto principal del evento en moneda base (siempre ≥ 0). */
  montoBase: number
  /** Ganancia(+)/pérdida(−) de la venta, en base. */
  resultadoBase?: number
  /** Retención ISR estimada del año (solo renta fija devengada). */
  isrEstimadoBase?: number
}

export interface OpcionesFiscal {
  tasaIsrAnual?: number
  udiActual?: number
}

/**
 * Eventos fiscales del año `anio` (1-ene a 31-dic), ordenados por fecha.
 * `hoy` acota el devengo de renta fija si el año sigue corriendo.
 */
export function eventosFiscales(
  activos: Activo[],
  operaciones: Operacion[],
  anio: number,
  hoy: string,
  opciones: OpcionesFiscal = {},
): EventoFiscal[] {
  const eventos: EventoFiscal[] = []
  const inicioAnio = `${anio}-01-01`
  const finAnio = `${anio}-12-31`
  const corte = hoy < finAnio ? hoy : finAnio
  const porActivo = new Map(activos.map((a) => [a.id, a]))

  // --- Ventas e ingresos, caminando el WAC por activo ---
  const grupos = new Map<string, Operacion[]>()
  for (const op of operaciones) {
    const lista = grupos.get(op.activoId)
    if (lista) lista.push(op)
    else grupos.set(op.activoId, [op])
  }

  for (const [activoId, ops] of grupos) {
    const activo = porActivo.get(activoId)
    if (!activo) continue
    let cantidad = 0
    let costoBase = 0

    for (const op of [...ops].sort(compararPorFecha)) {
      const tc = op.tipoCambio > 0 ? op.tipoCambio : 1
      const comisionBase = (op.comision ?? 0) * tc
      const importeBase = op.cantidad * op.precioUnitario * tc
      const enAnio = op.fecha >= inicioAnio && op.fecha <= finAnio

      switch (op.tipo) {
        case 'compra':
          cantidad += op.cantidad
          costoBase += importeBase + comisionBase
          break
        case 'venta': {
          const vendida = Math.min(op.cantidad, cantidad)
          if (vendida <= 0) break
          const pp = costoBase / cantidad
          const resultado = vendida * op.precioUnitario * tc - comisionBase - vendida * pp
          costoBase -= vendida * pp
          cantidad -= vendida
          if (enAnio) {
            eventos.push({
              tipo: resultado >= 0 ? 'venta_ganancia' : 'venta_perdida',
              fecha: op.fecha,
              activoId,
              simbolo: activo.simbolo,
              montoBase: redondear(vendida * op.precioUnitario * tc, 2),
              resultadoBase: redondear(resultado, 2),
            })
          }
          break
        }
        case 'ajuste': {
          if (op.cantidad >= 0) {
            cantidad += op.cantidad
            costoBase += importeBase
          } else {
            const retiro = Math.min(-op.cantidad, cantidad)
            if (cantidad > 0) {
              costoBase -= costoBase * (retiro / cantidad)
              cantidad -= retiro
            }
          }
          break
        }
        default: {
          if (OPERACIONES_EN_ESPECIE.has(op.tipo)) {
            cantidad += op.cantidad
            costoBase += importeBase
            if (enAnio && importeBase > 0) {
              eventos.push({
                tipo: 'ingreso_especie',
                fecha: op.fecha,
                activoId,
                simbolo: activo.simbolo,
                montoBase: redondear(importeBase - comisionBase, 2),
              })
            }
          } else if (OPERACIONES_EFECTIVO.has(op.tipo) && enAnio) {
            eventos.push({
              tipo: op.tipo === 'dividendo' ? 'dividendo' : 'interes_cobrado',
              fecha: op.fecha,
              activoId,
              simbolo: activo.simbolo,
              montoBase: redondear(importeBase - comisionBase, 2),
            })
          }
          break
        }
      }
    }

    // --- Devengo de renta fija dentro del año (estimación) ---
    const rf = activo.rentaFija
    if (rf && cantidad > 0 && costoBase > 0 && rf.fechaInicio <= corte) {
      const posicionRf = { cantidad, costoNativo: costoBase }
      const hasta = valuarRentaFija(rf, posicionRf, corte, opciones)
      const desde =
        rf.fechaInicio >= inicioAnio
          ? undefined
          : valuarRentaFija(rf, posicionRf, inicioAnio, opciones)
      const interesAnio = hasta.interesBrutoDevengado - (desde?.interesBrutoDevengado ?? 0)
      const isrAnio = hasta.isrEstimadoDevengado - (desde?.isrEstimadoDevengado ?? 0)
      if (interesAnio > 0.005) {
        eventos.push({
          tipo: 'interes_devengado_rf',
          fecha: corte,
          activoId,
          simbolo: activo.simbolo,
          montoBase: redondear(interesAnio, 2),
          isrEstimadoBase: redondear(Math.max(0, isrAnio), 2),
        })
      }
    }
  }

  return eventos.sort(compararPorFechaEvento)
}

function compararPorFechaEvento(a: EventoFiscal, b: EventoFiscal): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  return a.simbolo < b.simbolo ? -1 : a.simbolo > b.simbolo ? 1 : 0
}

export interface ResumenFiscal {
  gananciasVentas: number
  perdidasVentas: number
  dividendos: number
  interesesCobrados: number
  ingresosEspecie: number
  interesesDevengadosRf: number
  isrEstimadoRf: number
}

export function resumirEventos(eventos: EventoFiscal[]): ResumenFiscal {
  const r: ResumenFiscal = {
    gananciasVentas: 0,
    perdidasVentas: 0,
    dividendos: 0,
    interesesCobrados: 0,
    ingresosEspecie: 0,
    interesesDevengadosRf: 0,
    isrEstimadoRf: 0,
  }
  for (const e of eventos) {
    switch (e.tipo) {
      case 'venta_ganancia':
        r.gananciasVentas += e.resultadoBase ?? 0
        break
      case 'venta_perdida':
        r.perdidasVentas += e.resultadoBase ?? 0
        break
      case 'dividendo':
        r.dividendos += e.montoBase
        break
      case 'interes_cobrado':
        r.interesesCobrados += e.montoBase
        break
      case 'ingreso_especie':
        r.ingresosEspecie += e.montoBase
        break
      case 'interes_devengado_rf':
        r.interesesDevengadosRf += e.montoBase
        r.isrEstimadoRf += e.isrEstimadoBase ?? 0
        break
    }
  }
  for (const k of Object.keys(r) as (keyof ResumenFiscal)[]) r[k] = redondear(r[k], 2)
  return r
}
