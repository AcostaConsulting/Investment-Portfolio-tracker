import { describe, expect, it } from 'vitest'
import {
  alertasVencimiento,
  fechasCupon,
  isrEstimado,
  precioCete,
  tasaRendimientoCete,
  valuarRentaFija,
} from './rentaFija'
import type { Activo, DetalleRentaFija } from './tipos'

describe('CETES', () => {
  const cete: DetalleRentaFija = {
    instrumento: 'cetes',
    tasaAnual: 11,
    fechaInicio: '2026-01-01',
    fechaVencimiento: '2026-01-29', // 28 días
  }
  const posicion = { cantidad: 1000, costoNativo: 10_000 }

  it('interés al vencimiento con base 360', () => {
    const v = valuarRentaFija(cete, posicion, '2026-01-01')
    // 10,000 · 11% · 28/360 = 85.5556
    expect(v.interesBrutoAlVencimiento).toBeCloseTo(85.5556, 3)
    expect(v.diasPlazo).toBe(28)
  })

  it('devenga linealmente: a mitad del plazo lleva la mitad del interés', () => {
    const v = valuarRentaFija(cete, posicion, '2026-01-15') // día 14 de 28
    expect(v.interesBrutoDevengado).toBeCloseTo(85.5556 / 2, 3)
    expect(v.diasTranscurridos).toBe(14)
    expect(v.diasRestantes).toBe(14)
  })

  it('ISR estimado: % anual sobre capital prorrateado con base 365', () => {
    const v = valuarRentaFija(cete, posicion, '2026-01-29')
    // 10,000 · 1.9% · 28/365 = 14.5753
    expect(v.isrEstimadoDevengado).toBeCloseTo(14.5753, 3)
    expect(v.netoAlVencimiento).toBeCloseTo(10_000 + 85.5556 - 14.5753, 2)
  })

  it('después del vencimiento deja de devengar', () => {
    const v = valuarRentaFija(cete, posicion, '2026-03-01')
    expect(v.vencido).toBe(true)
    expect(v.diasTranscurridos).toBe(28) // tope en el plazo
    expect(v.interesBrutoDevengado).toBeCloseTo(85.5556, 3)
  })

  it('la tasa ISR del instrumento sobrescribe la global', () => {
    const conIsrPropio = { ...cete, tasaIsr: 0.5 }
    const v = valuarRentaFija(conIsrPropio, posicion, '2026-01-29', { tasaIsrAnual: 1.9 })
    expect(v.isrEstimadoDevengado).toBeCloseTo(10_000 * 0.005 * (28 / 365), 4)
  })

  it('precio teórico y tasa de rendimiento equivalente', () => {
    // P = 10·(1 − 11%·28/360) = 9.91444
    expect(precioCete(11, 28)).toBeCloseTo(9.91444, 4)
    // La tasa de rendimiento siempre supera a la de descuento
    expect(tasaRendimientoCete(11, 28)).toBeGreaterThan(11)
    expect(tasaRendimientoCete(11, 28)).toBeCloseTo(11.0949, 3)
  })
})

describe('pagarés y SoFIPOs', () => {
  it('tasa simple con base 360', () => {
    const pagare: DetalleRentaFija = {
      instrumento: 'pagare',
      tasaAnual: 12.5,
      fechaInicio: '2026-01-01',
      fechaVencimiento: '2026-04-01', // 90 días
    }
    const v = valuarRentaFija(pagare, { cantidad: 1, costoNativo: 50_000 }, '2026-04-01')
    // 50,000 · 12.5% · 90/360 = 1,562.50
    expect(v.interesBrutoAlVencimiento).toBeCloseTo(1562.5, 2)
    expect(v.interesBrutoDevengado).toBeCloseTo(1562.5, 2)
  })

  it('sofipo usa la misma convención que pagaré', () => {
    const sofipo: DetalleRentaFija = {
      instrumento: 'sofipo',
      tasaAnual: 15,
      fechaInicio: '2026-01-01',
      fechaVencimiento: '2026-07-30', // 210 días
    }
    const v = valuarRentaFija(sofipo, { cantidad: 1, costoNativo: 100_000 }, '2026-04-11') // día 100
    expect(v.interesBrutoDevengado).toBeCloseTo(100_000 * 0.15 * (100 / 360), 2)
  })
})

describe('ahorro con tasa variable (Nu y similares)', () => {
  it('capitaliza diario con base 365 y rinde más que el interés simple', () => {
    const ahorro: DetalleRentaFija = {
      instrumento: 'ahorro',
      tasaAnual: 15,
      fechaInicio: '2026-01-01',
    }
    const v = valuarRentaFija(ahorro, { cantidad: 1, costoNativo: 100_000 }, '2026-01-31') // 30 días
    const interesSimple = 100_000 * 0.15 * (30 / 365)
    expect(v.interesBrutoDevengado).toBeGreaterThan(interesSimple)
    expect(v.interesBrutoDevengado).toBeCloseTo(1240.25, 0)
    expect(v.diasRestantes).toBeUndefined()
    expect(v.vencido).toBe(false)
  })
})

describe('Bonos M', () => {
  const bono: DetalleRentaFija = {
    instrumento: 'bono_m',
    tasaAnual: 8,
    fechaInicio: '2026-01-01',
    fechaVencimiento: '2028-12-27', // 1091 días ≈ 6 cupones
    valorNominal: 100,
  }
  const posicion = { cantidad: 10, costoNativo: 1_000 } // 10 títulos, nominal 1,000

  it('devenga el cupón en curso sobre el valor nominal', () => {
    const v = valuarRentaFija(bono, posicion, '2026-04-02') // día 91 del cupón de 182
    // 1,000 · 8% · 91/360 = 20.2222 (medio cupón)
    expect(v.interesBrutoDevengado).toBeCloseTo(20.2222, 3)
  })

  it('al iniciar el segundo cupón el devengado se reinicia', () => {
    const v = valuarRentaFija(bono, posicion, '2026-07-03') // día 183 → día 1 del cupón 2
    expect(v.interesBrutoDevengado).toBeCloseTo(1_000 * 0.08 * (1 / 360), 4)
  })

  it('proyecta los cupones restantes al vencimiento', () => {
    const v0 = valuarRentaFija(bono, posicion, '2026-01-01')
    // 6 cupones de 1,000·8%·182/360 = 40.4444 c/u
    expect(v0.interesBrutoAlVencimiento).toBeCloseTo(6 * 40.4444, 2)
    const v1 = valuarRentaFija(bono, posicion, '2026-07-03') // ya pasó 1 cupón
    expect(v1.interesBrutoAlVencimiento).toBeCloseTo(5 * 40.4444, 2)
  })

  it('fechasCupon genera el calendario de 182 días terminando en el vencimiento', () => {
    const fechas = fechasCupon(bono)
    expect(fechas[0]).toBe('2026-07-02') // 182 días después del inicio
    expect(fechas[fechas.length - 1]).toBe('2028-12-27')
    expect(fechas.length).toBe(6)
  })
})

describe('UDIBONOS', () => {
  const udibono: DetalleRentaFija = {
    instrumento: 'udibono',
    tasaAnual: 4,
    fechaInicio: '2026-01-01',
    fechaVencimiento: '2029-01-01',
    valorNominal: 100, // 100 UDIs por título
    udiInicial: 8.0,
  }
  // 80 títulos comprados a la par: 80 · 100 UDIs · 8.0 = 64,000 pesos
  const posicion = { cantidad: 80, costoNativo: 64_000 }

  it('el principal se revalúa con la UDI', () => {
    const v = valuarRentaFija(udibono, posicion, '2026-01-01', { udiActual: 8.4 })
    // 64,000/8.0 = 8,000 UDIs · 8.4 = 67,200 → ajuste +3,200
    expect(v.valorBruto).toBeCloseTo(67_200, 0)
  })

  it('el cupón se calcula en UDIs y se paga en pesos a la UDI vigente', () => {
    const v = valuarRentaFija(udibono, posicion, '2026-04-02', { udiActual: 8.4 }) // día 91
    // 8,000 UDIs · 4% · 91/360 = 80.889 UDIs · 8.4 = 679.47 pesos
    expect(v.interesBrutoDevengado).toBeCloseTo(679.47, 1)
  })

  it('sin UDI vigente usa la de compra (sin ajuste de principal)', () => {
    const v = valuarRentaFija(udibono, posicion, '2026-04-02')
    expect(v.interesBrutoDevengado).toBeCloseTo(8_000 * 0.04 * (91 / 360) * 8.0, 1)
    expect(v.valorBruto).toBeCloseTo(64_000 + v.interesBrutoDevengado, 1)
  })
})

describe('alertas de vencimiento', () => {
  function activoRF(id: string, vencimiento: string): Activo {
    return {
      id,
      simbolo: id.toUpperCase(),
      nombre: id,
      clase: 'renta_fija',
      moneda: 'MXN',
      rentaFija: {
        instrumento: 'cetes',
        tasaAnual: 11,
        fechaInicio: '2026-01-01',
        fechaVencimiento: vencimiento,
      },
    }
  }

  it('incluye solo vencimientos dentro del umbral, ordenados por proximidad', () => {
    const activos = [
      activoRF('lejano', '2026-12-01'),
      activoRF('proximo', '2026-06-20'),
      activoRF('vencido', '2026-06-01'),
    ]
    const alertas = alertasVencimiento(activos, '2026-06-11', 30)
    expect(alertas.map((a) => a.activoId)).toEqual(['vencido', 'proximo'])
    expect(alertas[0]!.vencido).toBe(true)
    expect(alertas[1]!.diasRestantes).toBe(9)
  })

  it('ignora activos sin vencimiento (ahorro) y sin renta fija', () => {
    const ahorro: Activo = {
      id: 'nu',
      simbolo: 'NU',
      nombre: 'Nu',
      clase: 'renta_fija',
      moneda: 'MXN',
      rentaFija: { instrumento: 'ahorro', tasaAnual: 15, fechaInicio: '2026-01-01' },
    }
    const accion: Activo = { id: 'a', simbolo: 'A', nombre: 'A', clase: 'accion', moneda: 'MXN' }
    expect(alertasVencimiento([ahorro, accion], '2026-06-11')).toEqual([])
  })
})

describe('isrEstimado', () => {
  it('no aplica a días o capital no positivos', () => {
    expect(isrEstimado(10_000, 1.9, 0)).toBe(0)
    expect(isrEstimado(0, 1.9, 100)).toBe(0)
  })
})
