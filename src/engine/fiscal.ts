/**
 * Eventos fiscales DESCRIPTIVOS del año: qué pasó y por cuánto, para
 * platicarlo con un asesor. Este motor NO calcula impuestos.
 *
 * - Ventas: ganancia/pérdida de capital contra costo promedio ponderado
 *   (misma regla que el motor de portafolio — literalmente la misma función,
 *   `recorrerCosteo` de `costeo.ts`; antes era una copia propia que había
 *   divergido, §16).
 * - Renta fija: interés devengado en el año + retención ISR estimada
 *   (% anual sobre capital, prorrateado — reutiliza valuarRentaFija).
 * - Dividendos e intereses cobrados (operaciones).
 * - Ingresos en especie (staking/airdrop/recompensa) a valor de captura.
 *
 * Montos en moneda base usando el tipo de cambio de cada operación.
 */

import type { Activo, Advertencia, Operacion } from './tipos'
import { redondear } from './dinero'
import { valuarRentaFija } from './rentaFija'
import { recorrerCosteo } from './costeo'

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

  // El costeo lo hace `costeo.ts`; aquí solo se traduce a eventos del año.
  // Las advertencias son para la UI del portafolio, no para el reporte fiscal.
  const advertenciasIgnoradas: Advertencia[] = []

  for (const [activoId, ops] of grupos) {
    const activo = porActivo.get(activoId)
    if (!activo) continue
    const { estado, eventos: movimientos, tramos } = recorrerCosteo(activo, ops, advertenciasIgnoradas)
    const { cantidad, costoBase } = estado

    for (const movimiento of movimientos) {
      const op = movimiento.operacion
      if (op.fecha < inicioAnio || op.fecha > finAnio) continue

      switch (movimiento.tipo) {
        case 'venta':
          eventos.push({
            tipo: movimiento.resultadoBase >= 0 ? 'venta_ganancia' : 'venta_perdida',
            fecha: op.fecha,
            activoId,
            simbolo: activo.simbolo,
            montoBase: redondear(movimiento.brutoBase, 2),
            resultadoBase: redondear(movimiento.resultadoBase, 2),
          })
          break
        case 'especie':
          if (movimiento.brutoBase > 0) {
            eventos.push({
              tipo: 'ingreso_especie',
              fecha: op.fecha,
              activoId,
              simbolo: activo.simbolo,
              montoBase: redondear(movimiento.montoBase, 2),
            })
          }
          break
        case 'efectivo':
          eventos.push({
            tipo: op.tipo === 'dividendo' ? 'dividendo' : 'interes_cobrado',
            fecha: op.fecha,
            activoId,
            simbolo: activo.simbolo,
            montoBase: redondear(movimiento.montoBase, 2),
          })
          break
      }
    }

    // --- Devengo de renta fija dentro del año (estimación) ---
    const rf = activo.rentaFija
    // Ojo: NO se condiciona a `cantidad > 0`. Ese guard miraba la posición de
    // HOY, así que vender en 2026 borraba del reporte el interés que sí se
    // devengó en 2024 (AUDITORIA-ROBUSTEZ.md #5). Si durante el año no hubo
    // posición, la integral da cero y el evento no se emite igualmente.
    if (rf && rf.fechaInicio <= corte) {
      // Con `tramos`, el devengo integra la posición sostenida en cada momento.
      // Sin ellos, una operación posterior reescribía un año ya cerrado: una
      // compra de 2026 subía el interés declarado de 2024 de $1,216.67 a
      // $12,166.67, y vender lo dejaba en $0 (AUDITORIA-ROBUSTEZ.md #5).
      // La resta `hasta − desde` sigue dando el interés DEL AÑO porque la
      // integral es acumulativa desde `fechaInicio`.
      // `fiscal.ts` valúa siempre en moneda BASE (a diferencia de portafolio.ts,
      // §16.3), así que los tramos tienen que traer la misma pista: si no, el
      // devengo mezclaría base con nativo sin que nada lo dijera.
      const tramosBase = tramos.map((t) => ({ ...t, costoNativo: t.costoBase }))
      const posicionRf = { cantidad, costoNativo: costoBase, tramos: tramosBase }
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
