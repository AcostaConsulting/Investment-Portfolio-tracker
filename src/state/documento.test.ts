/**
 * `migrarDocumento` decide el destino de TODO documento que la app abre —
 * incluidos los corruptos— y hasta el 10 ago no tenía ni una prueba
 * (AUDITORIA-ROBUSTEZ.md §21.5). Estas son las primeras.
 */

import { describe, expect, it } from 'vitest'
import { documentoInicial, migrarDocumento, revisarForma } from './documento'

describe('revisarForma — atrapa el JSON válido con forma inútil', () => {
  it('un documento sano no tiene problemas', () => {
    expect(revisarForma(documentoInicial())).toEqual([])
  })

  it('acepta campos ausentes: los rellena la migración', () => {
    expect(revisarForma({ version: 1 })).toEqual([])
  })

  it('🔴 el caso que dejaba la ventana en BLANCO sin mensaje (hallazgo #7)', () => {
    // `?? []` solo atrapa null/undefined: un tipo equivocado pasaba entero y el
    // motor reventaba con "t is not iterable" — pantalla negra, cero explicación.
    const problemas = revisarForma({ version: 1, activos: 'no soy un arreglo', operaciones: 42 })
    expect(problemas).toContain('activos')
    expect(problemas).toContain('operaciones')
  })

  it.each([
    ['activos', { activos: 'x' }],
    ['operaciones', { operaciones: 42 }],
    ['etiquetas', { etiquetas: {} }],
    ['metas', { metas: 'no' }],
    ['alertasPrecio', { alertasPrecio: 1 }],
    ['benchmarks', { benchmarks: true }],
    ['historico', { historico: 'ayer' }],
  ])('detecta %s cuando no es un arreglo', (campo, doc) => {
    expect(revisarForma({ version: 1, ...doc })).toEqual([campo])
  })

  it.each([
    ['precios', { precios: [] }],
    ['tiposCambio', { tiposCambio: 'USD' }],
    ['ajustes', { ajustes: [] }],
  ])('detecta %s cuando no es un objeto', (campo, doc) => {
    expect(revisarForma({ version: 1, ...doc })).toEqual([campo])
  })

  it.each([[null], [undefined], ['texto'], [42], [[]]])('rechaza una raíz que no es objeto: %s', (crudo) => {
    expect(revisarForma(crudo)).toEqual(['documento'])
  })
})

describe('migrarDocumento — degrada, nunca truena', () => {
  it('conserva los datos del usuario', () => {
    const doc = migrarDocumento({
      version: 1,
      activos: [{ id: 'a1', simbolo: 'X', nombre: 'X', clase: 'accion', moneda: 'MXN' }],
      operaciones: [{ id: 'o1' }],
    })
    expect(doc.activos).toHaveLength(1)
    expect(doc.operaciones).toHaveLength(1)
  })

  it('rellena lo que falta con los valores por defecto', () => {
    const doc = migrarDocumento({ version: 1 })
    expect(doc.ajustes.monedaBase).toBe('MXN')
    expect(doc.historico).toEqual([])
    expect(doc.onboardingCompletado).toBe(false)
  })

  it('mezcla los ajustes en vez de reemplazarlos', () => {
    const doc = migrarDocumento({ version: 1, ajustes: { idioma: 'ja' } })
    expect(doc.ajustes.idioma).toBe('ja')
    expect(doc.ajustes.monedaBase).toBe('MXN') // el resto sobrevive
  })

  it('nunca devuelve algo que el motor no pueda recorrer, ni con basura', () => {
    const doc = migrarDocumento({ version: 1, activos: 'x', operaciones: 42, precios: [] })
    expect(Array.isArray(doc.activos)).toBe(true)
    expect(Array.isArray(doc.operaciones)).toBe(true)
    expect(() => [...doc.operaciones]).not.toThrow()
  })

  it('descarta elementos que no son objetos dentro de los arreglos', () => {
    const doc = migrarDocumento({ version: 1, activos: [null, 'texto', { id: 'a1' }, 7] })
    expect(doc.activos).toEqual([{ id: 'a1' }])
  })

  it('conserva los campos de una versión futura que no conoce', () => {
    const doc = migrarDocumento({ version: 99, campoDelFuturo: { x: 1 } }) as unknown as Record<string, unknown>
    expect(doc.campoDelFuturo).toEqual({ x: 1 })
  })
})
