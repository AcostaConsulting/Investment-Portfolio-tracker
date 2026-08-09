import { describe, expect, it } from 'vitest'
import { crearTablaFix, fechasHabiles, tcDofAplicable, type SerieFix } from './tcDof'

/**
 * Serie de juguete con un calendario bancario inventado pero explícito, para
 * poder razonar los casos a mano. Días hábiles:
 *
 *   lun 2026-01-05  17.00
 *   mar 2026-01-06  17.10
 *   mié 2026-01-07  17.20
 *   jue 2026-01-08  17.30
 *   vie 2026-01-09  17.40
 *   (sáb 10 y dom 11 no son hábiles)
 *   lun 2026-01-12  17.50
 *   (mar 13 feriado bancario: NO está en la serie)
 *   mié 2026-01-14  17.60
 */
const serie: SerieFix = {
  desde: '2026-01-05',
  hasta: '2026-01-14',
  //         05 06 07 08 09 12 14
  offsets: [0, 1, 1, 1, 1, 3, 2],
  tasas: [17.0, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6],
}

describe('fechasHabiles', () => {
  it('reconstruye las fechas a partir de los offsets', () => {
    expect(fechasHabiles(serie)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-12',
      '2026-01-14',
    ])
  })

  it('los huecos son el calendario bancario: el finde y el feriado no aparecen', () => {
    const fechas = fechasHabiles(serie)
    expect(fechas).not.toContain('2026-01-10') // sábado
    expect(fechas).not.toContain('2026-01-11') // domingo
    expect(fechas).not.toContain('2026-01-13') // feriado bancario
  })
})

describe('tcDofAplicable', () => {
  const tabla = crearTablaFix(serie)

  it('usa el FIX de DOS días hábiles antes, no el del mismo día', () => {
    // Operación el jueves 8: hábiles estrictamente antes son 7, 6, 5.
    // El segundo es el martes 6.
    const r = tcDofAplicable(tabla, '2026-01-08')
    expect(r).toEqual({ fechaFix: '2026-01-06', tasa: 17.1 })
  })

  it('salta el fin de semana al contar días hábiles', () => {
    // Operación el lunes 12: hábiles antes son vie 9, jue 8. El segundo es el 8.
    const r = tcDofAplicable(tabla, '2026-01-12')
    expect(r).toEqual({ fechaFix: '2026-01-08', tasa: 17.3 })
  })

  it('salta también el feriado bancario', () => {
    // Operación el miércoles 14: hábiles antes son lun 12 y vie 9
    // (el martes 13 no es hábil). El segundo es el viernes 9.
    const r = tcDofAplicable(tabla, '2026-01-14')
    expect(r).toEqual({ fechaFix: '2026-01-09', tasa: 17.4 })
  })

  it('una operación en sábado usa los hábiles anteriores, sin inventar nada', () => {
    // Sábado 10: hábiles estrictamente antes son vie 9 y jue 8.
    const r = tcDofAplicable(tabla, '2026-01-10')
    expect(r).toEqual({ fechaFix: '2026-01-08', tasa: 17.3 })
  })

  it('una operación en el feriado se resuelve igual', () => {
    // Martes 13 (feriado): hábiles antes son lun 12 y vie 9.
    const r = tcDofAplicable(tabla, '2026-01-13')
    expect(r).toEqual({ fechaFix: '2026-01-09', tasa: 17.4 })
  })

  it('devuelve undefined si no hay dos días hábiles previos', () => {
    // El primer día de la serie no tiene historia detrás.
    expect(tcDofAplicable(tabla, '2026-01-05')).toBeUndefined()
    expect(tcDofAplicable(tabla, '2026-01-06')).toBeUndefined()
    // El 7 sí: antes están el 6 y el 5.
    expect(tcDofAplicable(tabla, '2026-01-07')).toEqual({ fechaFix: '2026-01-05', tasa: 17.0 })
  })

  it('no responde más allá del final de la serie, ni por un día', () => {
    // La serie se empaqueta con la app y envejece entre releases. Pasado su
    // último dato ya no sabemos qué días fueron hábiles, así que el segundo
    // hábil anterior es incalculable: cualquier respuesta sería una suposición.
    // Quien llama decide si pide el dato a la red; el motor no adivina.
    expect(tcDofAplicable(tabla, '2026-01-15')).toBeUndefined()
    expect(tcDofAplicable(tabla, '2026-02-01')).toBeUndefined()
    // El último día cubierto sí resuelve: hábiles antes son 12 y 9.
    expect(tcDofAplicable(tabla, '2026-01-14')).toEqual({ fechaFix: '2026-01-09', tasa: 17.4 })
  })

  it('rechaza fechas mal formadas en vez de dar un número silencioso', () => {
    expect(tcDofAplicable(tabla, '')).toBeUndefined()
    expect(tcDofAplicable(tabla, '2026-1-8')).toBeUndefined()
  })
})
