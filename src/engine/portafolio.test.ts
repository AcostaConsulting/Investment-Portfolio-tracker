import { describe, expect, it } from 'vitest'
import { calcularPortafolio } from './portafolio'
import type { Activo, ContextoValuacion, Operacion } from './tipos'

const accionUsd: Activo = {
  id: 'aapl',
  simbolo: 'AAPL',
  nombre: 'Apple',
  clase: 'accion',
  moneda: 'USD',
}

const criptoBtc: Activo = {
  id: 'btc',
  simbolo: 'BTC',
  nombre: 'Bitcoin',
  clase: 'cripto',
  moneda: 'USD',
}

const accionMxn: Activo = {
  id: 'amxl',
  simbolo: 'AMX',
  nombre: 'América Móvil',
  clase: 'accion',
  moneda: 'MXN',
}

let secuencia = 0
function op(parcial: Partial<Operacion> & Pick<Operacion, 'activoId' | 'tipo' | 'fecha'>): Operacion {
  secuencia += 1
  return {
    id: `op-${String(secuencia).padStart(4, '0')}`,
    cantidad: 0,
    precioUnitario: 0,
    moneda: 'MXN',
    tipoCambio: 1,
    ...parcial,
  }
}

function contexto(parcial: Partial<ContextoValuacion> = {}): ContextoValuacion {
  return {
    monedaBase: 'MXN',
    hoy: '2026-06-11',
    precios: {},
    tiposCambio: {},
    ...parcial,
  }
}

describe('costo promedio ponderado', () => {
  it('una compra simple produce cantidad y costo exactos', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 15.5 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    expect(posiciones).toHaveLength(1)
    const p = posiciones[0]!
    expect(p.cantidad).toBe(100)
    expect(p.costoBase).toBeCloseTo(1550, 6)
    expect(p.precioPromedioBase).toBeCloseTo(15.5, 6)
  })

  it('compras a precios distintos promedian ponderado por cantidad', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-02-10', cantidad: 300, precioUnitario: 20 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    // (100·10 + 300·20) / 400 = 7000/400 = 17.5
    expect(posiciones[0]!.precioPromedioBase).toBeCloseTo(17.5, 6)
  })

  it('la comisión de compra se capitaliza al costo', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10, comision: 50 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    expect(posiciones[0]!.costoBase).toBeCloseTo(1050, 6)
    expect(posiciones[0]!.precioPromedioBase).toBeCloseTo(10.5, 6)
  })

  it('procesa por fecha aunque las operaciones lleguen desordenadas', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'venta', fecha: '2026-03-01', cantidad: 50, precioUnitario: 20 }),
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
    ]
    const { posiciones, advertencias } = calcularPortafolio([accionMxn], ops, contexto())
    expect(advertencias.some((a) => a.codigo === 'venta_excede_tenencia')).toBe(false)
    expect(posiciones[0]!.cantidad).toBe(50)
    expect(posiciones[0]!.realizadoBase).toBeCloseTo(500, 6)
  })
})

describe('ventas y P&L realizado', () => {
  it('venta parcial realiza P&L sobre el costo promedio y deja el resto al mismo PP', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 200, precioUnitario: 10 }),
      op({ activoId: 'amxl', tipo: 'venta', fecha: '2026-02-10', cantidad: 80, precioUnitario: 14, comision: 20 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    const p = posiciones[0]!
    // realizado = 80·14 − 20 − 80·10 = 1120 − 20 − 800 = 300
    expect(p.realizadoBase).toBeCloseTo(300, 6)
    expect(p.cantidad).toBe(120)
    expect(p.precioPromedioBase).toBeCloseTo(10, 6)
  })

  it('venta total cierra la posición en cero exacto (sin residuo flotante)', () => {
    const ops = [
      op({ activoId: 'btc', tipo: 'compra', fecha: '2026-01-10', cantidad: 0.1, precioUnitario: 60000, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'btc', tipo: 'compra', fecha: '2026-01-20', cantidad: 0.2, precioUnitario: 65000, moneda: 'USD', tipoCambio: 17.5 }),
      op({ activoId: 'btc', tipo: 'venta', fecha: '2026-03-01', cantidad: 0.30000000000000004, precioUnitario: 70000, moneda: 'USD', tipoCambio: 18 }),
    ]
    const { posiciones } = calcularPortafolio([criptoBtc], ops, contexto())
    const p = posiciones[0]!
    expect(p.cantidad).toBe(0)
    expect(p.costoBase).toBe(0)
  })

  it('vender más de la tenencia advierte y procesa solo lo disponible', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 10, precioUnitario: 10 }),
      op({ activoId: 'amxl', tipo: 'venta', fecha: '2026-02-10', cantidad: 25, precioUnitario: 12 }),
    ]
    const { posiciones, advertencias } = calcularPortafolio([accionMxn], ops, contexto())
    expect(advertencias.some((a) => a.codigo === 'venta_excede_tenencia')).toBe(true)
    expect(posiciones[0]!.cantidad).toBe(0)
    // Solo se realizan las 10 disponibles: 10·12 − 10·10 = 20
    expect(posiciones[0]!.realizadoBase).toBeCloseTo(20, 6)
  })
})

describe('ingresos: dividendos, intereses y en especie', () => {
  it('dividendo suma a ingresos sin tocar la cantidad', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
      op({ activoId: 'amxl', tipo: 'dividendo', fecha: '2026-04-01', cantidad: 100, precioUnitario: 0.45 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    expect(posiciones[0]!.cantidad).toBe(100)
    expect(posiciones[0]!.ingresosBase).toBeCloseTo(45, 6)
  })

  it('staking aumenta tenencia y registra el valor recibido como ingreso y costo', () => {
    const ops = [
      op({ activoId: 'btc', tipo: 'compra', fecha: '2026-01-10', cantidad: 1, precioUnitario: 60000, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'btc', tipo: 'staking', fecha: '2026-02-10', cantidad: 0.01, precioUnitario: 62000, moneda: 'USD', tipoCambio: 17 }),
    ]
    const { posiciones } = calcularPortafolio([criptoBtc], ops, contexto())
    const p = posiciones[0]!
    expect(p.cantidad).toBeCloseTo(1.01, 12)
    expect(p.ingresosBase).toBeCloseTo(0.01 * 62000 * 17, 6)
    expect(p.costoBase).toBeCloseTo(1 * 60000 * 17 + 0.01 * 62000 * 17, 6)
  })

  it('airdrop con precio 0 entra sin costo y sin ingreso', () => {
    const ops = [
      op({ activoId: 'btc', tipo: 'airdrop', fecha: '2026-02-10', cantidad: 5, precioUnitario: 0, moneda: 'USD', tipoCambio: 17 }),
    ]
    const { posiciones } = calcularPortafolio([criptoBtc], ops, contexto())
    expect(posiciones[0]!.cantidad).toBe(5)
    expect(posiciones[0]!.costoBase).toBe(0)
    expect(posiciones[0]!.ingresosBase).toBe(0)
  })
})

describe('ajustes', () => {
  it('ajuste positivo a precio 0 (split) baja el costo promedio sin cambiar el costo total', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 20 }),
      op({ activoId: 'amxl', tipo: 'ajuste', fecha: '2026-02-10', cantidad: 100, precioUnitario: 0 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    const p = posiciones[0]!
    expect(p.cantidad).toBe(200)
    expect(p.costoBase).toBeCloseTo(2000, 6)
    expect(p.precioPromedioBase).toBeCloseTo(10, 6)
  })

  it('ajuste negativo retira proporcionalmente sin realizar P&L', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 20 }),
      op({ activoId: 'amxl', tipo: 'ajuste', fecha: '2026-02-10', cantidad: -25, precioUnitario: 0 }),
    ]
    const { posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    const p = posiciones[0]!
    expect(p.cantidad).toBe(75)
    expect(p.costoBase).toBeCloseTo(1500, 6)
    expect(p.realizadoBase).toBe(0)
    expect(p.precioPromedioBase).toBeCloseTo(20, 6)
  })
})

describe('multimoneda', () => {
  it('convierte el costo con el tipo de cambio de cada operación', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-01-10', cantidad: 10, precioUnitario: 200, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-02-10', cantidad: 10, precioUnitario: 200, moneda: 'USD', tipoCambio: 18 }),
    ]
    const { posiciones } = calcularPortafolio([accionUsd], ops, contexto())
    const p = posiciones[0]!
    // 10·200·17 + 10·200·18 = 34,000 + 36,000 = 70,000 MXN
    expect(p.costoBase).toBeCloseTo(70000, 6)
    // En USD el promedio es limpio: 200
    expect(p.precioPromedioNativo).toBeCloseTo(200, 6)
    expect(p.monedaMixta).toBe(false)
  })

  it('la valuación usa el tipo de cambio vigente y captura el efecto FX en el P&L', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-01-10', cantidad: 10, precioUnitario: 200, moneda: 'USD', tipoCambio: 17 }),
    ]
    const ctx = contexto({
      precios: { aapl: { precio: 200, moneda: 'USD' } }, // mismo precio en USD
      tiposCambio: { USD: 18.5 },
    })
    const { posiciones } = calcularPortafolio([accionUsd], ops, ctx)
    const p = posiciones[0]!
    // El P&L viene 100% de la depreciación del peso: 10·200·(18.5−17) = 3,000
    expect(p.valorBase).toBeCloseTo(37000, 6)
    expect(p.pnlNoRealizadoBase).toBeCloseTo(3000, 6)
  })

  it('operación sin tipo de cambio válido advierte y usa 1:1', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-01-10', cantidad: 10, precioUnitario: 200, moneda: 'USD', tipoCambio: 0 }),
    ]
    const { advertencias } = calcularPortafolio([accionUsd], ops, contexto())
    expect(advertencias.some((a) => a.codigo === 'sin_tipo_cambio')).toBe(true)
  })

  it('operaciones en monedas mezcladas marcan monedaMixta y omiten el promedio nativo', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-01-10', cantidad: 10, precioUnitario: 200, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-02-10', cantidad: 10, precioUnitario: 3400, moneda: 'MXN', tipoCambio: 1 }),
    ]
    const { posiciones } = calcularPortafolio([accionUsd], ops, contexto())
    expect(posiciones[0]!.monedaMixta).toBe(true)
    expect(posiciones[0]!.precioPromedioNativo).toBeUndefined()
  })
})

describe('valuación y totales', () => {
  it('sin precio disponible cae al costo y lo advierte', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
    ]
    const { posiciones, advertencias } = calcularPortafolio([accionMxn], ops, contexto())
    expect(posiciones[0]!.sinPrecio).toBe(true)
    expect(posiciones[0]!.valorBase).toBeCloseTo(1000, 6)
    expect(advertencias.some((a) => a.codigo === 'sin_precio')).toBe(true)
  })

  it('los totales cuadran y la asignación por clase suma 100%', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
      op({ activoId: 'btc', tipo: 'compra', fecha: '2026-01-10', cantidad: 0.5, precioUnitario: 60000, moneda: 'USD', tipoCambio: 17 }),
    ]
    const ctx = contexto({
      precios: {
        amxl: { precio: 12, moneda: 'MXN' },
        btc: { precio: 64000, moneda: 'USD' },
      },
      tiposCambio: { USD: 18 },
    })
    const { totales } = calcularPortafolio([accionMxn, criptoBtc], ops, ctx)
    // amxl: 100·12 = 1,200 | btc: 0.5·64,000·18 = 576,000
    expect(totales.valorTotal).toBeCloseTo(577200, 2)
    expect(totales.costoTotal).toBeCloseTo(1000 + 0.5 * 60000 * 17, 2)
    expect(totales.pnlNoRealizado).toBeCloseTo(577200 - 511000, 2)
    const sumaPct = Object.values(totales.porClase).reduce((s, c) => s + c.pct, 0)
    expect(sumaPct).toBeCloseTo(100, 1)
  })

  it('posición cerrada conserva su P&L realizado en los totales', () => {
    const ops = [
      op({ activoId: 'amxl', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 }),
      op({ activoId: 'amxl', tipo: 'venta', fecha: '2026-02-10', cantidad: 100, precioUnitario: 15 }),
    ]
    const { totales, posiciones } = calcularPortafolio([accionMxn], ops, contexto())
    expect(posiciones[0]!.cantidad).toBe(0)
    expect(totales.pnlRealizado).toBeCloseTo(500, 2)
    expect(totales.valorTotal).toBe(0)
    expect(totales.gananciaTotal).toBeCloseTo(500, 2)
  })
})
