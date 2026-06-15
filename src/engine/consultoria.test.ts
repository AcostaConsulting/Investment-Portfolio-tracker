import { describe, expect, it } from 'vitest'
import { obtenerPrecioConsultoria, PRECIO_BASE_CONSULTORIA_MXN } from './consultoria'

describe('obtenerPrecioConsultoria', () => {
  it('el precio base es MXN $800', () => {
    expect(PRECIO_BASE_CONSULTORIA_MXN).toBe(800)
  })

  it('Free paga precio completo, sin descuento', () => {
    expect(obtenerPrecioConsultoria('free')).toEqual({
      precioBaseMxn: 800,
      descuentoPct: 0,
      precioFinalMxn: 800,
      ahorroMxn: 0,
    })
  })

  it('descuentos por plan: Pro 10%, Premium 15%, Lifetime 20% sobre $800', () => {
    expect(obtenerPrecioConsultoria('pro')).toMatchObject({ descuentoPct: 10, precioFinalMxn: 720 })
    expect(obtenerPrecioConsultoria('premium')).toMatchObject({ descuentoPct: 15, precioFinalMxn: 680 })
    expect(obtenerPrecioConsultoria('lifetime')).toMatchObject({ descuentoPct: 20, precioFinalMxn: 640 })
  })

  it('el ahorro cuadra contra el precio base', () => {
    const p = obtenerPrecioConsultoria('lifetime')
    expect(p.ahorroMxn).toBeCloseTo(PRECIO_BASE_CONSULTORIA_MXN - p.precioFinalMxn, 2)
    expect(p.ahorroMxn).toBe(160)
  })
})
