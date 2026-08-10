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

  it('mapea los encabezados reales de la plantilla (clase, monto, precio (USD), tipo cambio op.)', () => {
    const mapeo = adivinarMapeo([
      'Fecha',
      'Activo',
      'Clase',
      'Tipo',
      'Cantidad',
      'Precio unit. (USD)',
      'Monto MXN',
      'Tipo cambio op.',
      'Costo MXN equivalente',
      'Comisión USD',
      'Comisión MXN',
      'Notas',
    ])
    expect(mapeo).toMatchObject({
      fecha: 0,
      simbolo: 1,
      clase: 2,
      tipo: 3,
      cantidad: 4,
      precio: 5,
      importe: 6,
      tipoCambio: 7,
      comision: 9, // Comisión USD (la primera columna de comisión)
      nota: 11,
    })
    // 'Costo MXN equivalente' (8) no debe colarse en ningún campo.
    expect(Object.values(mapeo)).not.toContain(8)
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

  it('lee decimales escritos con coma, como los escribe media Latinoamérica', () => {
    // Antes esta fila entraba como 1.5 sólo por casualidad: `aNumero` tenía su
    // propia regla. Ahora usa el MISMO parser que los campos de captura.
    const { validas } = convertirFilas(
      [['2026-01-10', 'BTC', 'compra', '0,5', '1250000,50', 'MXN', 1]],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas[0]?.cantidad).toBeCloseTo(0.5, 9)
    expect(validas[0]?.precioUnitario).toBeCloseTo(1_250_000.5, 6)
  })

  it('🔴 descarta la fila cuando la cifra es AMBIGUA en vez de adivinar', () => {
    // "1,234" puede ser 1.234 o 1234. En un import por lotes no hay a quién
    // preguntarle, así que la fila se reporta como error en vez de entrar con
    // un número que nadie eligió (AUDITORIA-ROBUSTEZ.md #4).
    const { validas, errores } = convertirFilas(
      [['2026-01-10', 'AAPL', 'compra', '1,234', '100', 'MXN', 1]],
      mapeo,
      'MXN',
      new Set(),
    )
    expect(validas).toHaveLength(0)
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

describe('convertirFilas con clase, monto e importe (plantilla real)', () => {
  // Orden de columnas de la plantilla real: sin columna de moneda.
  const mapeoReal: Mapeo = {
    fecha: 0,
    simbolo: 1,
    clase: 2,
    tipo: 3,
    cantidad: 4,
    precio: 5,
    importe: 6,
    tipoCambio: 7,
  }

  it('Fix 1: lee la clase del Excel y la normaliza (Renta Fija → renta_fija)', () => {
    const { validas } = convertirFilas(
      [
        ['2025-08-01', 'KO', 'Accion', 'Compra', 1, 78, 1366.56, 17.52],
        ['2025-08-01', 'ETH', 'Cripto', 'Compra', 0.1, 2800, 4900, 17.5],
        ['2025-08-01', 'CETES', 'Renta Fija', 'Compra', 200, 1, 200, 1],
      ],
      mapeoReal,
      'MXN',
      new Set(),
    )
    expect(validas.map((v) => v.clase)).toEqual(['accion', 'cripto', 'renta_fija'])
  })

  it('Fix 2: cripto comprado con MXN sin precio unitario → deriva el precio USD, no se omite', () => {
    const { validas, errores } = convertirFilas(
      [['2025-07-06', 'ETH', 'Cripto', 'Compra', 0.03068501, null, 1500, 17.508228867567755]],
      mapeoReal,
      'MXN',
      new Set(),
    )
    expect(errores).toEqual([])
    expect(validas).toHaveLength(1)
    const v = validas[0]!
    expect(v.moneda).toBe('USD')
    expect(v.tipoCambio).toBeCloseTo(17.508228867567755, 6)
    // precio_USD = (monto_MXN / tc) / cantidad
    expect(v.precioUnitario).toBeCloseTo(1500 / 17.508228867567755 / 0.03068501, 4)
    // y el costo en base reconstruye el monto MXN original
    expect(v.cantidad * v.precioUnitario * v.tipoCambio).toBeCloseTo(1500, 2)
  })

  it('Fix 2: si el tipo de cambio viene null usa el TC por defecto', () => {
    const { validas, errores } = convertirFilas(
      [['2025-07-06', 'BTC', 'Cripto', 'Compra', 0.001, null, 1850, null]],
      mapeoReal,
      'MXN',
      new Set(),
      { tcPorDefecto: 18.5 },
    )
    expect(errores).toEqual([])
    expect(validas[0]!.tipoCambio).toBe(18.5)
    expect(validas[0]!.precioUnitario).toBeCloseTo(1850 / 18.5 / 0.001, 4)
  })

  it('Fix 3: staking con cantidad ya provista y sin precio entra con precio 0', () => {
    const { validas, errores } = convertirFilas(
      [['2025-09-01', 'SOL', 'Cripto', 'Staking', 0.0072693869, null, 0, null]],
      mapeoReal,
      'MXN',
      new Set(),
    )
    expect(errores).toEqual([])
    expect(validas).toHaveLength(1)
    expect(validas[0]!.tipo).toBe('staking')
    expect(validas[0]!.cantidad).toBeCloseTo(0.0072693869, 9)
    expect(validas[0]!.precioUnitario).toBe(0)
  })

  it('Fix 3: staking con cantidad 0 sí se rechaza (no hay nada que registrar)', () => {
    const { validas, errores } = convertirFilas(
      [['2025-09-01', 'SOL', 'Cripto', 'Staking', 0, null, 0, null]],
      mapeoReal,
      'MXN',
      new Set(),
    )
    expect(validas).toHaveLength(0)
    expect(errores[0]?.error).toBe('cantidad')
  })

  it('Fix 4: dividendo con cantidad 0 e importe → importeEfectivo, cantidad 0, no se omite', () => {
    const { validas, errores } = convertirFilas(
      [['2025-09-15', 'KO', 'Accion', 'Dividendo', 0, null, 9.54, 18.0033]],
      mapeoReal,
      'MXN',
      new Set(),
    )
    expect(errores).toEqual([])
    expect(validas).toHaveLength(1)
    const v = validas[0]!
    expect(v.tipo).toBe('dividendo')
    expect(v.cantidad).toBe(0)
    expect(v.precioUnitario).toBe(0)
    expect(v.moneda).toBe('USD')
    // importeEfectivo en moneda; ingreso en base = importeEfectivo × tc = monto MXN
    expect(v.importeEfectivo).toBeCloseTo(9.54 / 18.0033, 6)
    expect(v.importeEfectivo! * v.tipoCambio).toBeCloseTo(9.54, 4)
  })

  it('Fix 4: dividendo sin importe se rechaza', () => {
    const { validas, errores } = convertirFilas(
      [['2025-09-15', 'KO', 'Accion', 'Dividendo', 0, null, null, 18]],
      mapeoReal,
      'MXN',
      new Set(),
    )
    expect(validas).toHaveLength(0)
    expect(errores[0]?.error).toBe('importe')
  })
})
