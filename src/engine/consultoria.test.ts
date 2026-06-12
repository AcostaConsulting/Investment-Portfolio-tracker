import { describe, expect, it } from 'vitest'
import { obtenerPrecioConsultoria, PRECIO_BASE_CONSULTORIA_USD } from './consultoria'

describe('obtenerPrecioConsultoria', () => {
  it('Free paga precio completo, sin descuento', () => {
    expect(obtenerPrecioConsultoria('free')).toEqual({
      precioBaseUsd: 149,
      descuentoPct: 0,
      precioFinalUsd: 149,
      ahorroUsd: 0,
    })
  })

  it('descuentos por plan: Pro 10%, Premium 15%, Lifetime 20%', () => {
    expect(obtenerPrecioConsultoria('pro')).toMatchObject({ descuentoPct: 10, precioFinalUsd: 134.1 })
    expect(obtenerPrecioConsultoria('premium')).toMatchObject({ descuentoPct: 15, precioFinalUsd: 126.65 })
    expect(obtenerPrecioConsultoria('lifetime')).toMatchObject({ descuentoPct: 20, precioFinalUsd: 119.2 })
  })

  it('el ahorro cuadra contra el precio base', () => {
    const p = obtenerPrecioConsultoria('lifetime')
    expect(p.ahorroUsd).toBeCloseTo(PRECIO_BASE_CONSULTORIA_USD - p.precioFinalUsd, 2)
    expect(p.ahorroUsd).toBe(29.8)
  })
})
