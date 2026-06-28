import { describe, expect, it } from 'vitest'
import { ordenarPosiciones } from './orden'
import type { Posicion } from '../../engine/portafolio'

function pos(simbolo: string, parcial: Partial<Posicion> = {}): Posicion {
  return {
    activo: { id: simbolo, simbolo, nombre: simbolo, clase: 'accion', moneda: 'MXN' },
    cantidad: 1,
    costoBase: 0,
    monedaMixta: false,
    realizadoBase: 0,
    ingresosBase: 0,
    comisionesBase: 0,
    sinPrecio: false,
    ...parcial,
  }
}

describe('ordenarPosiciones', () => {
  it('por valor descendente (orden por defecto de la app)', () => {
    const r = ordenarPosiciones(
      [pos('A', { valorBase: 100 }), pos('B', { valorBase: 300 }), pos('C', { valorBase: 200 })],
      'valor',
      'desc',
    )
    expect(r.map((p) => p.activo.simbolo)).toEqual(['B', 'C', 'A'])
  })

  it('por valor ascendente', () => {
    const r = ordenarPosiciones([pos('A', { valorBase: 100 }), pos('B', { valorBase: 300 })], 'valor', 'asc')
    expect(r.map((p) => p.activo.simbolo)).toEqual(['A', 'B'])
  })

  it('por símbolo alfabético, asc y desc, sin distinguir mayúsculas', () => {
    const ps = [pos('MSFT'), pos('AAPL'), pos('btc')]
    expect(ordenarPosiciones(ps, 'simbolo', 'asc').map((p) => p.activo.simbolo)).toEqual(['AAPL', 'btc', 'MSFT'])
    expect(ordenarPosiciones(ps, 'simbolo', 'desc').map((p) => p.activo.simbolo)).toEqual(['MSFT', 'btc', 'AAPL'])
  })

  it('por rendimiento descendente', () => {
    const r = ordenarPosiciones(
      [pos('A', { rendimientoPct: -5 }), pos('B', { rendimientoPct: 12 }), pos('C', { rendimientoPct: 3 })],
      'rendimiento',
      'desc',
    )
    expect(r.map((p) => p.activo.simbolo)).toEqual(['B', 'C', 'A'])
  })

  it('trata un valorBase ausente como 0', () => {
    const r = ordenarPosiciones([pos('A', { valorBase: undefined }), pos('B', { valorBase: 50 })], 'valor', 'desc')
    expect(r.map((p) => p.activo.simbolo)).toEqual(['B', 'A'])
  })

  it('no muta el arreglo original', () => {
    const ps = [pos('A', { valorBase: 1 }), pos('B', { valorBase: 2 })]
    const r = ordenarPosiciones(ps, 'valor', 'desc')
    expect(r).not.toBe(ps)
    expect(ps.map((p) => p.activo.simbolo)).toEqual(['A', 'B'])
  })
})
