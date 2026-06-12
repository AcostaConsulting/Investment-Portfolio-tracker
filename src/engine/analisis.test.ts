import { describe, expect, it } from 'vitest'
import { evaluarAlertas, type ConfigAlerta } from './alertas'
import { calcularLiquidez } from './liquidez'
import { evaluarMetas, type MetaFinanciera } from './metas'
import { eventosFiscales, resumirEventos } from './fiscal'
import type { Posicion } from './portafolio'
import type { Activo, Operacion } from './tipos'

function posicion(parcial: {
  id: string
  clase?: Activo['clase']
  liquido?: boolean
  valor: number
  cantidad?: number
}): Posicion {
  return {
    activo: {
      id: parcial.id,
      simbolo: parcial.id.toUpperCase(),
      nombre: parcial.id,
      clase: parcial.clase ?? 'accion',
      moneda: 'MXN',
      ...(parcial.liquido === false ? { liquido: false } : {}),
    },
    cantidad: parcial.cantidad ?? 1,
    costoBase: parcial.valor,
    monedaMixta: false,
    realizadoBase: 0,
    ingresosBase: 0,
    comisionesBase: 0,
    valorBase: parcial.valor,
    sinPrecio: false,
  }
}

describe('evaluarAlertas', () => {
  const posiciones = [posicion({ id: 'btc', valor: 100 }), posicion({ id: 'aapl', valor: 100 })]
  const config: ConfigAlerta[] = [
    { id: 'a1', activoId: 'btc', precioMin: 50_000, precioMax: 80_000, activa: true },
    { id: 'a2', activoId: 'aapl', precioMax: 250, activa: true },
    { id: 'a3', activoId: 'aapl', precioMin: 100, activa: false },
  ]

  it('dispara por techo y por piso, con el umbral que cruzó', () => {
    const d = evaluarAlertas(posiciones, config, {
      btc: { precio: 82_000, moneda: 'USD' },
      aapl: { precio: 240, moneda: 'USD' },
    })
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ configId: 'a1', tipo: 'max', umbral: 80_000, precioActual: 82_000 })
  })

  it('en el límite exacto también dispara', () => {
    const d = evaluarAlertas(posiciones, config, { btc: { precio: 50_000, moneda: 'USD' } })
    expect(d[0]).toMatchObject({ tipo: 'min', umbral: 50_000 })
  })

  it('ignora alertas inactivas y activos sin precio', () => {
    const d = evaluarAlertas(posiciones, config, { aapl: { precio: 50, moneda: 'USD' } })
    expect(d).toHaveLength(0) // a3 (min 100) está inactiva; btc no tiene precio
  })
})

describe('calcularLiquidez', () => {
  it('separa líquido de ilíquido y calcula el ratio', () => {
    const l = calcularLiquidez(
      [
        posicion({ id: 'a', valor: 900 }),
        posicion({ id: 'b', valor: 100, liquido: false }),
        posicion({ id: 'cerrada', valor: 0, cantidad: 0, liquido: false }),
      ],
      10,
    )
    expect(l.valorLiquido).toBe(900)
    expect(l.valorIliquido).toBe(100)
    expect(l.ratioPct).toBe(90)
    expect(l.debajoDelUmbral).toBe(false)
  })

  it('avisa cuando el ratio queda bajo el umbral', () => {
    const l = calcularLiquidez(
      [posicion({ id: 'a', valor: 50 }), posicion({ id: 'b', valor: 950, liquido: false })],
      10,
    )
    expect(l.ratioPct).toBe(5)
    expect(l.debajoDelUmbral).toBe(true)
  })

  it('portafolio vacío no avisa ni divide entre cero', () => {
    const l = calcularLiquidez([], 10)
    expect(l.ratioPct).toBe(0)
    expect(l.debajoDelUmbral).toBe(false)
  })
})

describe('evaluarMetas', () => {
  const posiciones = [
    posicion({ id: 'a', clase: 'accion', valor: 600 }),
    posicion({ id: 'b', clase: 'cripto', valor: 400 }),
  ]

  it('meta total usa todo el portafolio; meta por clase filtra', () => {
    const metas: MetaFinanciera[] = [
      { id: 'm1', nombre: 'Total', objetivo: 2000 },
      { id: 'm2', nombre: 'Cripto', objetivo: 400, clase: 'cripto' },
    ]
    const [total, cripto] = evaluarMetas(posiciones, metas)
    expect(total).toMatchObject({ valorActual: 1000, pct: 50, alcanzada: false })
    expect(cripto).toMatchObject({ valorActual: 400, pct: 100, alcanzada: true })
  })

  it('el progreso se topa en 100% aunque el valor exceda el objetivo', () => {
    const [p] = evaluarMetas(posiciones, [{ id: 'm', nombre: 'x', objetivo: 500 }])
    expect(p!.pct).toBe(100)
    expect(p!.alcanzada).toBe(true)
  })
})

describe('eventosFiscales', () => {
  const accion: Activo = { id: 'aapl', simbolo: 'AAPL', nombre: 'Apple', clase: 'accion', moneda: 'USD' }
  const cete: Activo = {
    id: 'cete',
    simbolo: 'CETES-364',
    nombre: 'CETES',
    clase: 'renta_fija',
    moneda: 'MXN',
    rentaFija: {
      instrumento: 'cetes',
      tasaAnual: 10,
      fechaInicio: '2025-07-01',
      fechaVencimiento: '2026-06-30', // cruza el año fiscal
    },
  }
  let n = 0
  const op = (p: Partial<Operacion> & Pick<Operacion, 'activoId' | 'tipo' | 'fecha'>): Operacion => ({
    id: `f${++n}`,
    cantidad: 0,
    precioUnitario: 0,
    moneda: 'MXN',
    tipoCambio: 1,
    ...p,
  })

  it('describe ventas con ganancia y pérdida contra el WAC', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2025-11-01', cantidad: 10, precioUnitario: 100, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'venta', fecha: '2026-02-01', cantidad: 5, precioUnitario: 120, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'venta', fecha: '2026-03-01', cantidad: 5, precioUnitario: 80, moneda: 'USD', tipoCambio: 17 }),
    ]
    const eventos = eventosFiscales([accion], ops, 2026, '2026-06-11')
    const ventas = eventos.filter((e) => e.tipo.startsWith('venta'))
    expect(ventas).toHaveLength(2)
    // ganancia: 5·(120−100)·17 = 1,700 | pérdida: 5·(80−100)·17 = −1,700
    expect(ventas[0]).toMatchObject({ tipo: 'venta_ganancia', resultadoBase: 1700 })
    expect(ventas[1]).toMatchObject({ tipo: 'venta_perdida', resultadoBase: -1700 })
  })

  it('la venta del año anterior no aparece, pero sí ajusta el costo', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2025-01-01', cantidad: 10, precioUnitario: 100, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'venta', fecha: '2025-06-01', cantidad: 5, precioUnitario: 120, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'venta', fecha: '2026-01-15', cantidad: 5, precioUnitario: 120, moneda: 'USD', tipoCambio: 17 }),
    ]
    const eventos = eventosFiscales([accion], ops, 2026, '2026-06-11')
    expect(eventos.filter((e) => e.tipo.startsWith('venta'))).toHaveLength(1)
  })

  it('dividendos e ingresos en especie del año, con montos en base', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-01-01', cantidad: 10, precioUnitario: 100, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'dividendo', fecha: '2026-03-01', cantidad: 10, precioUnitario: 0.5, moneda: 'USD', tipoCambio: 18 }),
      op({ activoId: 'aapl', tipo: 'recompensa', fecha: '2026-04-01', cantidad: 1, precioUnitario: 90, moneda: 'USD', tipoCambio: 18 }),
    ]
    const eventos = eventosFiscales([accion], ops, 2026, '2026-06-11')
    expect(eventos.find((e) => e.tipo === 'dividendo')?.montoBase).toBeCloseTo(90, 2)
    expect(eventos.find((e) => e.tipo === 'ingreso_especie')?.montoBase).toBeCloseTo(1620, 2)
  })

  it('renta fija: interés devengado e ISR solo de la parte del año', () => {
    const ops = [
      op({ activoId: 'cete', tipo: 'compra', fecha: '2025-07-01', cantidad: 1, precioUnitario: 100_000 }),
    ]
    const eventos = eventosFiscales([cete], ops, 2026, '2026-06-11', { tasaIsrAnual: 1.9 })
    const rf = eventos.find((e) => e.tipo === 'interes_devengado_rf')!
    // Devengado del 1-ene al 11-jun-2026 = 161 días: 100,000·10%·161/360
    expect(rf.montoBase).toBeCloseTo(100_000 * 0.1 * (161 / 360), 0)
    expect(rf.isrEstimadoBase).toBeCloseTo(100_000 * 0.019 * (161 / 365), 0)
  })

  it('resumirEventos acumula por categoría', () => {
    const ops = [
      op({ activoId: 'aapl', tipo: 'compra', fecha: '2026-01-01', cantidad: 10, precioUnitario: 100, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'venta', fecha: '2026-02-01', cantidad: 5, precioUnitario: 120, moneda: 'USD', tipoCambio: 17 }),
      op({ activoId: 'aapl', tipo: 'dividendo', fecha: '2026-03-01', cantidad: 100, precioUnitario: 1, moneda: 'MXN', tipoCambio: 1 }),
    ]
    const r = resumirEventos(eventosFiscales([accion], ops, 2026, '2026-12-31'))
    expect(r.gananciasVentas).toBe(1700)
    expect(r.dividendos).toBe(100)
    expect(r.perdidasVentas).toBe(0)
  })
})
