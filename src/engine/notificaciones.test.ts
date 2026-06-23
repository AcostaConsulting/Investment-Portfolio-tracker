import { describe, expect, it } from 'vitest'
import { claveAlerta, detectarNuevasAlertas } from './notificaciones'
import type { AlertaDisparada } from './alertas'

function disparada(parcial: Partial<AlertaDisparada> = {}): AlertaDisparada {
  return {
    configId: 'a1',
    activoId: 'act1',
    simbolo: 'AAPL',
    tipo: 'min',
    precioActual: 90,
    umbral: 100,
    moneda: 'USD',
    ...parcial,
  }
}

describe('detectarNuevasAlertas', () => {
  it('en la primera evaluación, todas las disparadas son nuevas', () => {
    const a = disparada({ configId: 'a1', tipo: 'min' })
    const b = disparada({ configId: 'a2', tipo: 'max' })
    const { nuevas, clavesActuales } = detectarNuevasAlertas(new Set(), [a, b])
    expect(nuevas).toEqual([a, b])
    expect(clavesActuales).toEqual(new Set(['a1:min', 'a2:max']))
  })

  it('una alerta que sigue disparada no se vuelve a notificar', () => {
    const a = disparada({ configId: 'a1', tipo: 'min' })
    const previas = new Set(['a1:min'])
    const { nuevas, clavesActuales } = detectarNuevasAlertas(previas, [a])
    expect(nuevas).toEqual([])
    expect(clavesActuales).toEqual(new Set(['a1:min']))
  })

  it('solo notifica la alerta nueva cuando otra ya estaba disparada', () => {
    const vieja = disparada({ configId: 'a1', tipo: 'min' })
    const nueva = disparada({ configId: 'a2', tipo: 'max' })
    const { nuevas } = detectarNuevasAlertas(new Set(['a1:min']), [vieja, nueva])
    expect(nuevas).toEqual([nueva])
  })

  it('una alerta que se apaga y vuelve a dispararse se notifica otra vez', () => {
    const a = disparada({ configId: 'a1', tipo: 'min' })
    // Estaba disparada; ahora ya no hay ninguna → el conjunto queda vacío.
    const paso1 = detectarNuevasAlertas(new Set(['a1:min']), [])
    expect(paso1.nuevas).toEqual([])
    expect(paso1.clavesActuales.size).toBe(0)
    // Vuelve a dispararse: como ya no estaba en el conjunto, se notifica.
    const paso2 = detectarNuevasAlertas(paso1.clavesActuales, [a])
    expect(paso2.nuevas).toEqual([a])
  })

  it('el piso y el techo de la misma config son claves distintas', () => {
    const piso = disparada({ configId: 'a1', tipo: 'min' })
    const techo = disparada({ configId: 'a1', tipo: 'max' })
    expect(claveAlerta(piso)).not.toBe(claveAlerta(techo))
    const { nuevas } = detectarNuevasAlertas(new Set(['a1:min']), [piso, techo])
    expect(nuevas).toEqual([techo])
  })

  it('ignora claves duplicadas en la misma evaluación', () => {
    const a = disparada({ configId: 'a1', tipo: 'min' })
    const { nuevas, clavesActuales } = detectarNuevasAlertas(new Set(), [a, a])
    expect(nuevas).toEqual([a])
    expect(clavesActuales.size).toBe(1)
  })
})
