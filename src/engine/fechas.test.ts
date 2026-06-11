import { describe, expect, it } from 'vitest'
import { compararPorFecha, diasEntre, esFechaIsoValida, sumarDias } from './fechas'
import { redondear, aMonedaBase } from './dinero'

describe('fechas', () => {
  it('diasEntre cuenta días completos y respeta el signo', () => {
    expect(diasEntre('2026-01-01', '2026-01-29')).toBe(28)
    expect(diasEntre('2026-01-29', '2026-01-01')).toBe(-28)
    expect(diasEntre('2026-06-11', '2026-06-11')).toBe(0)
  })

  it('diasEntre cruza años bisiestos sin desfase', () => {
    expect(diasEntre('2024-02-28', '2024-03-01')).toBe(2) // 2024 es bisiesto
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('sumarDias regresa fecha ISO', () => {
    expect(sumarDias('2026-01-01', 182)).toBe('2026-07-02')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('esFechaIsoValida rechaza formatos y fechas imposibles', () => {
    expect(esFechaIsoValida('2026-06-11')).toBe(true)
    expect(esFechaIsoValida('2026-02-30')).toBe(false)
    expect(esFechaIsoValida('11/06/2026')).toBe(false)
    expect(esFechaIsoValida('')).toBe(false)
  })

  it('compararPorFecha desempata por id para un orden estable', () => {
    const a = { fecha: '2026-01-01', id: 'a' }
    const b = { fecha: '2026-01-01', id: 'b' }
    const c = { fecha: '2026-01-02', id: 'a' }
    expect([c, b, a].sort(compararPorFecha)).toEqual([a, b, c])
  })
})

describe('dinero', () => {
  it('redondear corrige el sesgo flotante clásico', () => {
    expect(redondear(0.1 + 0.2, 2)).toBe(0.3)
    expect(redondear(1.005, 2)).toBe(1.01)
    expect(redondear(1234.5678, 2)).toBe(1234.57)
  })

  it('aMonedaBase convierte con el mapa y nunca inventa un 1:1', () => {
    expect(aMonedaBase(100, 'USD', 'MXN', { USD: 18 })).toBe(1800)
    expect(aMonedaBase(100, 'MXN', 'MXN', {})).toBe(100)
    expect(aMonedaBase(100, 'USD', 'MXN', {})).toBeUndefined()
    expect(aMonedaBase(100, 'USD', 'MXN', { USD: 0 })).toBeUndefined()
  })
})
