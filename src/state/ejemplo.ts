/**
 * Portafolio ficticio para el onboarding: 2 acciones (AAPL, KO),
 * 1 cripto (BTC) y 1 CETES, con movimientos suficientes para que el
 * Dashboard se vea vivo. El usuario puede borrarlo cuando quiera.
 */

import type { Activo, Operacion, PrecioActual } from '../engine/tipos'
import { hoyIso, sumarDias } from '../engine/fechas'

export interface DatosEjemplo {
  activos: Activo[]
  operaciones: Operacion[]
  precios: Record<string, PrecioActual>
  tiposCambio: Record<string, number>
}

export function crearDatosEjemplo(): DatosEjemplo {
  const hoy = hoyIso()
  const aapl: Activo = {
    id: crypto.randomUUID(),
    simbolo: 'AAPL',
    nombre: 'Apple Inc.',
    clase: 'accion',
    moneda: 'USD',
    sector: 'technology',
    geografia: 'eua',
  }
  const ko: Activo = {
    id: crypto.randomUUID(),
    simbolo: 'KO',
    nombre: 'Coca-Cola Co.',
    clase: 'accion',
    moneda: 'USD',
    sector: 'consumer_staples',
    geografia: 'eua',
  }
  const btc: Activo = {
    id: crypto.randomUUID(),
    simbolo: 'BTC',
    nombre: 'Bitcoin',
    clase: 'cripto',
    moneda: 'USD',
    sector: 'Layer 1',
    geografia: 'global',
  }
  const cetes: Activo = {
    id: crypto.randomUUID(),
    simbolo: 'CETES-182',
    nombre: 'CETES 182 días',
    clase: 'renta_fija',
    moneda: 'MXN',
    geografia: 'mexico',
    rentaFija: {
      instrumento: 'cetes',
      tasaAnual: 9.8,
      fechaInicio: sumarDias(hoy, -75),
      fechaVencimiento: sumarDias(hoy, 107),
    },
  }

  const op = (
    activoId: string,
    tipo: Operacion['tipo'],
    fecha: string,
    cantidad: number,
    precioUnitario: number,
    moneda: string,
    tipoCambio: number,
    comision?: number,
  ): Operacion => ({
    id: crypto.randomUUID(),
    activoId,
    tipo,
    fecha,
    cantidad,
    precioUnitario,
    moneda,
    tipoCambio,
    ...(comision ? { comision } : {}),
  })

  const operaciones: Operacion[] = [
    op(aapl.id, 'compra', sumarDias(hoy, -270), 10, 182.5, 'USD', 17.45, 12),
    op(aapl.id, 'compra', sumarDias(hoy, -140), 5, 201.0, 'USD', 17.2, 8),
    op(aapl.id, 'dividendo', sumarDias(hoy, -90), 15, 0.26, 'USD', 17.3),
    op(ko.id, 'compra', sumarDias(hoy, -240), 20, 59.8, 'USD', 17.5, 10),
    op(ko.id, 'dividendo', sumarDias(hoy, -60), 20, 0.51, 'USD', 17.15),
    op(btc.id, 'compra', sumarDias(hoy, -210), 0.05, 64_500, 'USD', 17.35, 25),
    op(btc.id, 'compra', sumarDias(hoy, -110), 0.03, 91_200, 'USD', 17.1, 18),
    op(cetes.id, 'compra', sumarDias(hoy, -75), 50_000, 1, 'MXN', 1),
  ]

  return {
    activos: [aapl, ko, btc, cetes],
    operaciones,
    precios: {
      [aapl.id]: { precio: 214.4, moneda: 'USD', actualizado: hoy },
      [ko.id]: { precio: 63.9, moneda: 'USD', actualizado: hoy },
      [btc.id]: { precio: 104_800, moneda: 'USD', actualizado: hoy },
    },
    tiposCambio: { USD: 18.2 },
  }
}
