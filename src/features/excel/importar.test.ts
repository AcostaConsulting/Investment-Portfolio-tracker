import { describe, expect, it } from 'vitest'
import { adivinarMapeo, aFechaIso, celdaATexto, convertirFilas, type Mapeo } from './importar'

describe('adivinarMapeo', () => {
  it('reconoce encabezados en español con acentos y mayúsculas', () => {
    const mapeo = adivinarMapeo(['Fecha', 'Símbolo', 'Tipo', 'Cantidad', 'Precio', 'Moneda', 'Tipo de Cambio', 'Comisión', 'Nota'])
    expect(mapeo).toEqual({
      fecha: 0,
      simbolo: 1,
      tipo: 2,
      cantidad: 3,
      precio: 4,
      moneda: 5,
      tipoCambio: 6,
      comision: 7,
      nota: 8,
    })
  })

  it('reconoce encabezados en inglés', () => {
    const mapeo = adivinarMapeo(['Date', 'Ticker', 'Side', 'Qty', 'Price', 'Currency', 'FX', 'Fee', 'Notes'])
    expect(mapeo.fecha).toBe(0)
    expect(mapeo.simbolo).toBe(1)
    expect(mapeo.tipo).toBe(2)
    expect(mapeo.cantidad).toBe(3)
    expect(mapeo.tipoCambio).toBe(6)
  })

  it('deja sin mapear lo que no reconoce', () => {
    const mapeo = adivinarMapeo(['Foo', 'Bar'])
    expect(Object.keys(mapeo)).toHaveLength(0)
  })
})

describe('aFechaIso', () => {
  it('acepta ISO, dd/mm/aaaa, Date y serial de Excel', () => {
    expect(aFechaIso('2026-06-11')).toBe('2026-06-11')
    expect(aFechaIso('11/06/2026')).toBe('2026-06-11')
    expect(aFechaIso('1/6/2026')).toBe('2026-06-01')
    expect(aFechaIso(new Date(Date.UTC(2026, 5, 11)))).toBe('2026-06-11')
    expect(aFechaIso(46184)).toBe('2026-06-11') // serial de Excel
  })

  it('rechaza basura', () => {
    expect(aFechaIso('hola')).toBeUndefined()
    expect(aFechaIso('')).toBeUndefined()
    expect(aFechaIso(123)).toBeUndefined()
  })
})

describe('celdaATexto', () => {
  it('aplana richText, hipervínculos y fórmulas de exceljs', () => {
    expect(celdaATexto({ richText: [{ text: 'AA' }, { text: 'PL' }] })).toBe('AAPL')
    expect(celdaATexto({ text: 'BTC', hyperlink: 'http://x' })).toBe('BTC')
    expect(celdaATexto({ formula: 'A1*2', result: 42 })).toBe('42')
    expect(celdaATexto(null)).toBe('')
  })
})

describe('convertirFilas', () => {
  const mapeo: Mapeo = { fecha: 0, simbolo: 1, tipo: 2, cantidad: 3, precio: 4, moneda: 5, tipoCambio: 6 }

  it('convierte filas válidas y detecta símbolos nuevos', () => {
    const { validas, errores, simbolosNuevos } = convertirFilas(
      [
        ['2026-01-10', 'AAPL', 'compra', 10, 200, 'USD', 17.5],
        ['2026-02-10', 'amxl', 'Venta', 5, 16, 'MXN', ''],
      ],
      mapeo,
      'MXN',
      new Set(['AMXL']),
    )
    expect(errores).toEqual([])
    expect(validas).toHaveLength(2)
    expect(validas[0]).toMatchObject({ simbolo: 'AAPL', tipo: 'compra', tipoCambio: 17.5 })
    // Moneda base sin TC explícito → 1
    expect(validas[1]).toMatchObject({ simbolo: 'AMXL', tipo: 'venta', tipoCambio: 1 })
    expect(simbolosNuevos).toEqual(['AAPL'])
  })

  it('acepta tipos en inglés (buy/sell/dividend)', () => {
    const { validas } = convertirFilas(
      [['2026-01-10', 'AAPL', 'BUY', 1, 100, 'MXN', 1]],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas[0]?.tipo).toBe('compra')
  })

  it('reporta errores por fila con el número visible en Excel', () => {
    const { validas, errores } = convertirFilas(
      [
        ['fecha-mala', 'AAPL', 'compra', 1, 100, 'MXN', 1],
        ['2026-01-10', '', 'compra', 1, 100, 'MXN', 1],
        ['2026-01-10', 'AAPL', 'regalo', 1, 100, 'MXN', 1],
        ['2026-01-10', 'AAPL', 'compra', -5, 100, 'MXN', 1],
        ['2026-01-10', 'AAPL', 'compra', 1, 100, 'USD', ''], // USD sin TC
      ],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas).toHaveLength(0)
    expect(errores.map((e) => e.fila)).toEqual([2, 3, 4, 5, 6])
    expect(errores.map((e) => e.error)).toEqual(['fecha', 'simbolo', 'tipo', 'cantidad', 'tipoCambio'])
  })

  it('ignora filas completamente vacías sin marcarlas como error', () => {
    const { validas, errores } = convertirFilas(
      [
        [null, null, null, null, null, null, null],
        ['2026-01-10', 'AAPL', 'compra', 1, 100, 'MXN', 1],
      ],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas).toHaveLength(1)
    expect(errores).toEqual([])
  })

  it('el ajuste permite cantidad negativa pero no cero', () => {
    const { validas, errores } = convertirFilas(
      [
        ['2026-01-10', 'AAPL', 'ajuste', -3, 0, 'MXN', 1],
        ['2026-01-10', 'AAPL', 'ajuste', 0, 0, 'MXN', 1],
      ],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas).toHaveLength(1)
    expect(validas[0]?.cantidad).toBe(-3)
    expect(errores).toHaveLength(1)
  })

  it('limpia números con separador de miles', () => {
    const { validas } = convertirFilas(
      [['2026-01-10', 'BTC', 'compra', '0.5', '1,250,000.50', 'MXN', 1]],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas[0]?.precioUnitario).toBeCloseTo(1_250_000.5, 6)
  })
})
