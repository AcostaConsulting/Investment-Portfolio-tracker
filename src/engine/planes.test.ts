import { describe, expect, it } from 'vitest'
import { compararPlanes, obtenerCapacidades, PLANES } from './planes'

describe('obtenerCapacidades', () => {
  it('Free: lo esencial sí, lo de pago no, 1 etiqueta', () => {
    const c = obtenerCapacidades('free')
    expect(c.activosIlimitados).toBe(true)
    expect(c.importarExcel).toBe(true)
    expect(c.rentaFijaMexicana).toBe(true)
    expect(c.exportarExcel).toBe(false)
    expect(c.alertasPrecio).toBe(false)
    expect(c.maxEtiquetasPorActivo).toBe(1)
    expect(c.descuentoConsultoria).toBe(0)
  })

  it('Pro: análisis básico sí, Premium no, 10% consultoría', () => {
    const c = obtenerCapacidades('pro')
    expect(c.exportarExcel).toBe(true)
    expect(c.preciosEnVivo).toBe(true)
    expect(c.alertasPrecio).toBe(true)
    expect(c.analisisComisiones).toBe(true)
    expect(c.benchmarks).toBe(true)
    expect(c.rebalanceo).toBe(false)
    expect(c.metas).toBe(false)
    expect(c.maxEtiquetasPorActivo).toBe(1)
    expect(c.descuentoConsultoria).toBe(10)
  })

  it('Premium y Lifetime: todo, etiquetas ilimitadas, 15%/20%', () => {
    const premium = obtenerCapacidades('premium')
    const lifetime = obtenerCapacidades('lifetime')
    for (const c of [premium, lifetime]) {
      expect(c.rebalanceo).toBe(true)
      expect(c.metas).toBe(true)
      expect(c.maxEtiquetasPorActivo).toBe('ilimitadas')
    }
    expect(premium.descuentoConsultoria).toBe(15)
    expect(lifetime.descuentoConsultoria).toBe(20)
  })
})

describe('compararPlanes', () => {
  it('la matriz cubre los 4 planes y las 13 features', () => {
    const m = compararPlanes()
    expect(m.planes).toEqual(PLANES)
    expect(m.filas).toHaveLength(13)
    for (const fila of m.filas) {
      expect(Object.keys(fila.porPlan).sort()).toEqual([...PLANES].sort())
    }
  })

  it('convierte valores no booleanos a celdas legibles', () => {
    const m = compararPlanes()
    const etiquetas = m.filas.find((f) => f.clave === 'maxEtiquetasPorActivo')!
    expect(etiquetas.porPlan.free).toBe('1')
    expect(etiquetas.porPlan.premium).toBe('∞')
    const descuento = m.filas.find((f) => f.clave === 'descuentoConsultoria')!
    expect(descuento.porPlan.free).toBe(false) // 0% = no incluido
    expect(descuento.porPlan.lifetime).toBe('20%')
  })
})
