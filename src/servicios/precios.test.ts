import { describe, expect, it } from 'vitest'
import { parseChartV8, parseQuoteV7 } from './precios'

describe('parseQuoteV7 (endpoint viejo, en lote)', () => {
  it('extrae precio y moneda en mayúsculas por símbolo', () => {
    const datos = {
      quoteResponse: {
        result: [
          { symbol: 'AAPL', regularMarketPrice: 214.4, currency: 'usd' },
          { symbol: 'AMXL.MX', regularMarketPrice: 16.2, currency: 'MXN' },
        ],
      },
    }
    expect(parseQuoteV7(datos)).toEqual({
      AAPL: { precio: 214.4, moneda: 'USD' },
      'AMXL.MX': { precio: 16.2, moneda: 'MXN' },
    })
  })

  it('ignora filas sin precio o sin moneda', () => {
    const datos = {
      quoteResponse: {
        result: [
          { symbol: 'AAPL', regularMarketPrice: 200, currency: 'USD' },
          { symbol: 'SINPRECIO', currency: 'USD' },
          { symbol: 'SINMONEDA', regularMarketPrice: 10 },
        ],
      },
    }
    expect(Object.keys(parseQuoteV7(datos))).toEqual(['AAPL'])
  })

  it('respuesta vacía o mal formada → objeto vacío (no truena)', () => {
    expect(parseQuoteV7({})).toEqual({})
    expect(parseQuoteV7({ quoteResponse: {} })).toEqual({})
    expect(parseQuoteV7(null)).toEqual({})
  })
})

describe('parseChartV8 (endpoint nuevo, fallback por símbolo)', () => {
  it('lee precio y moneda desde chart.result[0].meta', () => {
    const datos = {
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 214.4, currency: 'USD', symbol: 'AAPL' },
            indicators: { quote: [{ close: [212, 214.4] }] },
          },
        ],
      },
    }
    expect(parseChartV8(datos)).toEqual({ precio: 214.4, moneda: 'USD' })
  })

  it('normaliza la moneda a mayúsculas', () => {
    const datos = { chart: { result: [{ meta: { regularMarketPrice: 16.2, currency: 'mxn' } }] } }
    expect(parseChartV8(datos)).toEqual({ precio: 16.2, moneda: 'MXN' })
  })

  it('devuelve undefined si falta el precio, la moneda o el meta', () => {
    expect(parseChartV8({ chart: { result: [{ meta: { currency: 'USD' } }] } })).toBeUndefined()
    expect(parseChartV8({ chart: { result: [{ meta: { regularMarketPrice: 10 } }] } })).toBeUndefined()
    expect(parseChartV8({ chart: { result: [] } })).toBeUndefined()
    expect(parseChartV8({})).toBeUndefined()
    // Respuesta de error de Yahoo
    expect(parseChartV8({ chart: { result: null, error: { code: 'Unauthorized' } } })).toBeUndefined()
  })
})
