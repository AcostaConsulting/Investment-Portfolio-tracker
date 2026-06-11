import { describe, expect, it } from 'vitest'
import { calcularDistribucionEtiquetas, puedeAgregarEtiqueta } from './etiquetas'
import { calcularDiversificacion, SIN_CLASIFICAR } from './diversificacion'
import type { Posicion } from './portafolio'
import type { Activo } from './tipos'

function posicion(parcial: {
  id: string
  clase?: Activo['clase']
  sector?: string
  geografia?: Activo['geografia']
  etiquetaIds?: string[]
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
      ...(parcial.sector ? { sector: parcial.sector } : {}),
      ...(parcial.geografia ? { geografia: parcial.geografia } : {}),
      ...(parcial.etiquetaIds ? { etiquetaIds: parcial.etiquetaIds } : {}),
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

describe('puedeAgregarEtiqueta', () => {
  it('Free y Pro topan en 1 etiqueta por activo', () => {
    expect(puedeAgregarEtiqueta('free', 0)).toBe(true)
    expect(puedeAgregarEtiqueta('free', 1)).toBe(false)
    expect(puedeAgregarEtiqueta('pro', 1)).toBe(false)
  })

  it('Premium y Lifetime no tienen límite', () => {
    expect(puedeAgregarEtiqueta('premium', 99)).toBe(true)
    expect(puedeAgregarEtiqueta('lifetime', 99)).toBe(true)
  })
})

describe('calcularDistribucionEtiquetas', () => {
  const posiciones = [
    posicion({ id: 'a', etiquetaIds: ['retiro'], valor: 600 }),
    posicion({ id: 'b', etiquetaIds: ['retiro', 'riesgo'], valor: 300 }),
    posicion({ id: 'c', valor: 100 }),
    posicion({ id: 'cerrada', etiquetaIds: ['retiro'], valor: 0, cantidad: 0 }),
  ]

  it('suma valor y % solo de posiciones abiertas con la etiqueta', () => {
    const d = calcularDistribucionEtiquetas(posiciones, 'retiro')
    expect(d.valor).toBe(900)
    expect(d.pct).toBe(90)
    expect(d.cantidadActivos).toBe(2)
  })

  it('etiqueta sin activos regresa ceros', () => {
    const d = calcularDistribucionEtiquetas(posiciones, 'inexistente')
    expect(d).toMatchObject({ valor: 0, pct: 0, cantidadActivos: 0 })
  })
})

describe('calcularDiversificacion', () => {
  const posiciones = [
    posicion({ id: 'a', clase: 'accion', sector: 'technology', geografia: 'eua', valor: 500 }),
    posicion({ id: 'b', clase: 'accion', sector: 'technology', geografia: 'mexico', valor: 300 }),
    posicion({ id: 'c', clase: 'cripto', etiquetaIds: ['riesgo'], valor: 200 }),
  ]
  const etiquetas = [{ id: 'riesgo', nombre: 'Alto riesgo', color: '#f00' }]

  it('agrupa por las cuatro dimensiones con % sobre el total', () => {
    const v = calcularDiversificacion(posiciones, etiquetas)
    expect(v.valorTotal).toBe(1000)
    expect(v.porClase).toEqual([
      { clave: 'accion', valor: 800, pct: 80 },
      { clave: 'cripto', valor: 200, pct: 20 },
    ])
    expect(v.porSector[0]).toEqual({ clave: 'technology', valor: 800, pct: 80 })
    expect(v.porSector[1]!.clave).toBe(SIN_CLASIFICAR)
    expect(v.porGeografia.map((r) => r.clave)).toEqual(['eua', 'mexico', SIN_CLASIFICAR])
  })

  it('las etiquetas llevan su nombre visible y excluyen lo sin etiquetar', () => {
    const v = calcularDiversificacion(posiciones, etiquetas)
    expect(v.porEtiqueta).toEqual([{ clave: 'riesgo', nombre: 'Alto riesgo', valor: 200, pct: 20 }])
  })

  it('portafolio vacío no divide entre cero', () => {
    const v = calcularDiversificacion([], [])
    expect(v.valorTotal).toBe(0)
    expect(v.porClase).toEqual([])
  })
})
