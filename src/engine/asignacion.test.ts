/**
 * Asignación por clase: fija el comportamiento de las DOS vías que la calculan
 * (`TotalesPortafolio.porClase` y `VistaDiversificacion.porClase`) y que den el
 * mismo número.
 *
 * Estas pruebas se escribieron y corrieron en verde ANTES de consolidar las dos
 * implementaciones en una sola (handoff §13.3): son la red que respalda que la
 * consolidación no cambió ningún número, no una descripción del código nuevo.
 */

import { describe, expect, it } from 'vitest'
import { calcularPortafolio } from './portafolio'
import { calcularDiversificacion } from './diversificacion'
import type { Activo, ContextoValuacion, Operacion } from './tipos'

const accionMxn: Activo = { id: 'a1', simbolo: 'A1', nombre: 'Acción MXN', clase: 'accion', moneda: 'MXN' }
const accionUsd: Activo = { id: 'a2', simbolo: 'A2', nombre: 'Acción USD', clase: 'accion', moneda: 'USD' }
const criptoUsd: Activo = { id: 'c1', simbolo: 'C1', nombre: 'Cripto USD', clase: 'cripto', moneda: 'USD' }
const rentaFija: Activo = { id: 'r1', simbolo: 'R1', nombre: 'Renta fija', clase: 'renta_fija', moneda: 'MXN' }
const cerrada: Activo = { id: 'a3', simbolo: 'A3', nombre: 'Ya vendida', clase: 'accion', moneda: 'MXN' }
const sinOperaciones: Activo = { id: 'a4', simbolo: 'A4', nombre: 'Sin actividad', clase: 'accion', moneda: 'MXN' }

let secuencia = 0
function op(parcial: Partial<Operacion> & Pick<Operacion, 'activoId' | 'tipo' | 'fecha'>): Operacion {
  secuencia += 1
  return {
    id: `op-${secuencia}`,
    cantidad: 0,
    precioUnitario: 0,
    moneda: 'MXN',
    tipoCambio: 1,
    ...parcial,
  }
}

/**
 * Cartera de referencia, con las trampas que importan: una posición cerrada, un
 * activo sin ninguna operación, renta fija sin precio (cae a costo) y dos
 * activos en moneda extranjera.
 */
const ACTIVOS = [accionMxn, accionUsd, criptoUsd, rentaFija, cerrada, sinOperaciones]
const OPERACIONES = [
  op({ activoId: 'a1', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
  op({ activoId: 'a2', tipo: 'compra', fecha: '2026-01-11', cantidad: 10, precioUnitario: 10, moneda: 'USD', tipoCambio: 18 }),
  op({ activoId: 'c1', tipo: 'compra', fecha: '2026-01-12', cantidad: 2, precioUnitario: 100, moneda: 'USD', tipoCambio: 19 }),
  op({ activoId: 'r1', tipo: 'compra', fecha: '2026-01-13', cantidad: 100, precioUnitario: 10 }),
  op({ activoId: 'a3', tipo: 'compra', fecha: '2026-01-14', cantidad: 5, precioUnitario: 100 }),
  op({ activoId: 'a3', tipo: 'venta', fecha: '2026-02-14', cantidad: 5, precioUnitario: 120 }),
]

function contexto(parcial: Partial<ContextoValuacion> = {}): ContextoValuacion {
  return {
    monedaBase: 'MXN',
    hoy: '2026-07-30',
    precios: {
      a1: { precio: 12, moneda: 'MXN' }, // 100 × 12          = 1,200
      a2: { precio: 15, moneda: 'USD' }, // 10 × 15 × 20      = 3,000
      c1: { precio: 120, moneda: 'USD' }, // 2 × 120 × 20     = 4,800
      // r1 sin precio a propósito: cae a costo = 1,000
    },
    tiposCambio: { USD: 20 },
    ...parcial,
  }
}

/** La vista devuelve una lista ordenada; para comparar hace falta la misma forma. */
function comoRegistro(rebanadas: { clave: string; valor: number; pct: number }[]) {
  return Object.fromEntries(rebanadas.map((r) => [r.clave, { valor: r.valor, pct: r.pct }]))
}

describe('asignación por clase — comportamiento fijado', () => {
  const portafolio = calcularPortafolio(ACTIVOS, OPERACIONES, contexto())
  const vista = calcularDiversificacion(portafolio.posiciones, [])

  it('el valor total reparte solo las posiciones abiertas', () => {
    // 1,200 + 3,000 + 4,800 + 1,000 = 10,000. La cerrada (a3) no suma.
    expect(portafolio.totales.valorTotal).toBe(10000)
    expect(vista.valorTotal).toBe(10000)
  })

  it('el motor da los valores y porcentajes por clase', () => {
    expect(portafolio.totales.porClase).toEqual({
      accion: { valor: 4200, pct: 42 },
      cripto: { valor: 4800, pct: 48 },
      renta_fija: { valor: 1000, pct: 10 },
    })
  })

  it('la diversificación da lo mismo, ordenado por valor descendente', () => {
    expect(vista.porClase).toEqual([
      { clave: 'cripto', valor: 4800, pct: 48 },
      { clave: 'accion', valor: 4200, pct: 42 },
      { clave: 'renta_fija', valor: 1000, pct: 10 },
    ])
  })

  it('las dos vías coinciden clase por clase', () => {
    expect(comoRegistro(vista.porClase)).toEqual(portafolio.totales.porClase)
  })

  it('una clase cuyo único activo está cerrado no aparece en ninguna de las dos', () => {
    // a3 es 'accion' y está cerrada; 'accion' sigue apareciendo por a1 y a2,
    // pero su valor no incluye nada de a3.
    expect(portafolio.totales.porClase['accion']!.valor).toBe(4200)
    expect(portafolio.posiciones.find((p) => p.activo.id === 'a3')!.cantidad).toBe(0)
  })

  it('un activo sin operaciones no entra en el reparto', () => {
    expect(portafolio.posiciones.some((p) => p.activo.id === 'a4')).toBe(false)
  })

  it('el peso de cada posición es coherente con el porcentaje de su clase', () => {
    const abiertas = portafolio.posiciones.filter((p) => p.cantidad > 0)
    const porClase = new Map<string, number>()
    for (const p of abiertas) {
      porClase.set(p.activo.clase, (porClase.get(p.activo.clase) ?? 0) + (p.pesoPct ?? 0))
    }
    expect(porClase.get('accion')).toBeCloseTo(42, 2) // 12 + 30
    expect(porClase.get('cripto')).toBeCloseTo(48, 2)
    expect(porClase.get('renta_fija')).toBeCloseTo(10, 2)
  })
})

describe('asignación por clase — casos límite', () => {
  it('sin posiciones: las dos quedan vacías y no truenan', () => {
    const portafolio = calcularPortafolio([], [], contexto())
    const vista = calcularDiversificacion(portafolio.posiciones, [])
    expect(portafolio.totales.porClase).toEqual({})
    expect(vista.porClase).toEqual([])
    expect(portafolio.totales.valorTotal).toBe(0)
    expect(vista.valorTotal).toBe(0)
  })

  it('solo posiciones cerradas: valor total cero y reparto vacío', () => {
    const ops = [
      op({ activoId: 'a3', tipo: 'compra', fecha: '2026-01-14', cantidad: 5, precioUnitario: 100 }),
      op({ activoId: 'a3', tipo: 'venta', fecha: '2026-02-14', cantidad: 5, precioUnitario: 120 }),
    ]
    const portafolio = calcularPortafolio([cerrada], ops, contexto())
    const vista = calcularDiversificacion(portafolio.posiciones, [])
    expect(portafolio.totales.valorTotal).toBe(0)
    expect(portafolio.totales.porClase).toEqual({})
    expect(vista.porClase).toEqual([])
  })

  it('valor total cero con posiciones abiertas: porcentajes en cero, no NaN', () => {
    const ops = [op({ activoId: 'a1', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 0 })]
    const portafolio = calcularPortafolio([accionMxn], ops, contexto({ precios: {} }))
    const vista = calcularDiversificacion(portafolio.posiciones, [])
    expect(portafolio.totales.valorTotal).toBe(0)
    expect(portafolio.totales.porClase).toEqual({ accion: { valor: 0, pct: 0 } })
    expect(vista.porClase).toEqual([{ clave: 'accion', valor: 0, pct: 0 }])
    expect(comoRegistro(vista.porClase)).toEqual(portafolio.totales.porClase)
  })

  it('sin precio y multi-moneda no separan a las dos vías', () => {
    const ops = [
      op({ activoId: 'a1', tipo: 'compra', fecha: '2026-01-10', cantidad: 3, precioUnitario: 0.1 }),
      op({ activoId: 'c1', tipo: 'compra', fecha: '2026-01-12', cantidad: 3, precioUnitario: 0.2, moneda: 'USD', tipoCambio: 17.4755 }),
      op({ activoId: 'r1', tipo: 'compra', fecha: '2026-01-13', cantidad: 7, precioUnitario: 0.7 }),
    ]
    const portafolio = calcularPortafolio([accionMxn, criptoUsd, rentaFija], ops, contexto({ tiposCambio: {} }))
    const vista = calcularDiversificacion(portafolio.posiciones, [])
    expect(comoRegistro(vista.porClase)).toEqual(portafolio.totales.porClase)
    expect(vista.valorTotal).toBe(portafolio.totales.valorTotal)
  })
})
