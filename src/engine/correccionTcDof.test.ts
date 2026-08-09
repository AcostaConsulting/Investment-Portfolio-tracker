import { describe, expect, it } from 'vitest'
import { aplicarCorrecciones, correccionesTcDof, resumirCorrecciones } from './correccionTcDof'
import { crearTablaFix, type SerieFix } from './tcDof'
import type { Operacion } from './tipos'

// Calendario de juguete, hábiles: 5,6,7,8,9,12 de enero de 2026.
const serie: SerieFix = {
  desde: '2026-01-05',
  hasta: '2026-01-12',
  offsets: [0, 1, 1, 1, 1, 3],
  tasas: [17.0, 17.1, 17.2, 17.3, 17.4, 17.5],
}
const tabla = crearTablaFix(serie)

let n = 0
const op = (p: Partial<Operacion> & Pick<Operacion, 'fecha' | 'tipo'>): Operacion => ({
  id: `o${++n}`,
  activoId: 'aapl',
  cantidad: 10,
  precioUnitario: 100,
  moneda: 'USD',
  tipoCambio: 18,
  ...p,
})

describe('correccionesTcDof', () => {
  it('propone el FIX de dos días hábiles antes para las operaciones en USD', () => {
    // Operación el 9: hábiles antes son 8 y 7. El segundo es el 7 → 17.2.
    const ops = [op({ fecha: '2026-01-09', tipo: 'compra' })]
    const c = correccionesTcDof(ops, tabla, 'MXN')
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ fecha: '2026-01-09', tcActual: 18, fechaFix: '2026-01-07', tcDof: 17.2 })
  })

  it('ignora las operaciones que ya están en la moneda base', () => {
    const ops = [op({ fecha: '2026-01-09', tipo: 'compra', moneda: 'MXN', tipoCambio: 1 })]
    expect(correccionesTcDof(ops, tabla, 'MXN')).toEqual([])
  })

  it('ignora monedas a las que no les aplica la regla del DOF', () => {
    const ops = [op({ fecha: '2026-01-09', tipo: 'compra', moneda: 'EUR' })]
    expect(correccionesTcDof(ops, tabla, 'MXN')).toEqual([])
  })

  it('ignora las que ya tienen el TC correcto: no propone cambios de cero', () => {
    const ops = [op({ fecha: '2026-01-09', tipo: 'compra', tipoCambio: 17.2 })]
    expect(correccionesTcDof(ops, tabla, 'MXN')).toEqual([])
  })

  it('omite las operaciones que la serie no puede resolver, sin inventarles TC', () => {
    const ops = [
      op({ fecha: '2026-01-05', tipo: 'compra' }), // sin dos hábiles previos
      op({ fecha: '2026-02-01', tipo: 'compra' }), // más allá de la serie
    ]
    expect(correccionesTcDof(ops, tabla, 'MXN')).toEqual([])
  })

  it('usa importeEfectivo cuando la operación es de flujo de efectivo', () => {
    // Un dividendo se guarda con cantidad y precio en 0 (§16.2).
    const ops = [
      op({ fecha: '2026-01-09', tipo: 'dividendo', cantidad: 0, precioUnitario: 0, importeEfectivo: 50 }),
    ]
    const c = correccionesTcDof(ops, tabla, 'MXN')
    expect(c[0]!.importeActualBase).toBeCloseTo(50 * 18, 6)
    expect(c[0]!.importeDofBase).toBeCloseTo(50 * 17.2, 6)
  })

  it('calcula el importe en base con cantidad × precio para las demás', () => {
    const ops = [op({ fecha: '2026-01-09', tipo: 'compra', cantidad: 3, precioUnitario: 200 })]
    const c = correccionesTcDof(ops, tabla, 'MXN')
    expect(c[0]!.importeActualBase).toBeCloseTo(600 * 18, 6)
    expect(c[0]!.importeDofBase).toBeCloseTo(600 * 17.2, 6)
  })
})

describe('resumirCorrecciones', () => {
  it('suma el efecto por tipo de operación y en total', () => {
    const ops = [
      op({ fecha: '2026-01-09', tipo: 'compra', cantidad: 1, precioUnitario: 100 }),
      op({ fecha: '2026-01-09', tipo: 'venta', cantidad: 1, precioUnitario: 100 }),
    ]
    const r = resumirCorrecciones(correccionesTcDof(ops, tabla, 'MXN'))
    expect(r.total).toBe(2)
    // 100 × (17.2 − 18) = −80 por operación
    expect(r.deltaBase).toBeCloseTo(-160, 6)
    expect(r.porTipo.compra).toBeCloseTo(-80, 6)
    expect(r.porTipo.venta).toBeCloseTo(-80, 6)
  })
})

describe('aplicarCorrecciones', () => {
  const doc = {
    operaciones: [
      op({ fecha: '2026-01-09', tipo: 'compra' }),
      op({ fecha: '2026-01-09', tipo: 'venta' }),
    ],
  }

  it('sólo toca las operaciones listadas, y sólo su tipoCambio', () => {
    const correcciones = correccionesTcDof(doc.operaciones, tabla, 'MXN')
    const soloUna = correcciones.filter((c) => c.operacionId === doc.operaciones[0]!.id)
    const nuevo = aplicarCorrecciones(doc.operaciones, soloUna)

    expect(nuevo[0]!.tipoCambio).toBe(17.2)
    expect(nuevo[1]!.tipoCambio).toBe(18) // intacta
    // Nada más cambió en la operación corregida.
    expect({ ...nuevo[0], tipoCambio: 0 }).toEqual({ ...doc.operaciones[0], tipoCambio: 0 })
  })

  it('no muta el arreglo original', () => {
    const correcciones = correccionesTcDof(doc.operaciones, tabla, 'MXN')
    aplicarCorrecciones(doc.operaciones, correcciones)
    expect(doc.operaciones[0]!.tipoCambio).toBe(18)
  })

  it('sin correcciones devuelve las operaciones tal cual', () => {
    expect(aplicarCorrecciones(doc.operaciones, [])).toEqual(doc.operaciones)
  })
})
