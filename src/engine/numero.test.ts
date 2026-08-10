/**
 * Pruebas del parser de números — escritas ANTES de la implementación y
 * corridas en rojo, con la disciplina de §13.3.
 *
 * El bug que las motiva (AUDITORIA-ROBUSTEZ.md #4): los `<input type="number">`
 * dejaban que Chromium interpretara la cifra con el locale del SISTEMA mientras
 * la app la mostraba con el idioma de la APP. En 4 de 7 combinaciones medidas
 * no coincidían, y el fallo era mudo: `1,5` se guardaba como **15** y
 * `1234,56` como **123456** — 10× y 100× de error, sin un solo aviso.
 */

import { describe, expect, it } from 'vitest'
import { lecturasAmbiguas, parsearNumero } from './numero'

const valor = (texto: string) => {
  const r = parsearNumero(texto)
  return r.ok ? r.valor : `ERROR:${r.motivo}`
}

describe('parsearNumero — un separador, decimal inequívoco', () => {
  it.each([
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['0,5', 0.5],
    ['0.5', 0.5],
    ['1,25', 1.25],
    ['9,75', 9.75],
    ['0,00000001', 1e-8],
    ['0.00000001', 1e-8],
    ['1,00000001', 1.00000001],
    [',5', 0.5],
    ['.5', 0.5],
    ['1,', 1],
    ['1.', 1],
  ])('%s -> %s', (texto, esperado) => {
    expect(valor(texto)).toBeCloseTo(esperado as number, 12)
  })
})

describe('parsearNumero — sin separador', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['1234', 1234],
    ['1000000', 1000000],
  ])('%s -> %s', (texto, esperado) => {
    expect(valor(texto)).toBe(esperado)
  })
})

describe('parsearNumero — dos separadores distintos: el último manda', () => {
  it.each([
    ['1.234,56', 1234.56], // formato europeo/latino
    ['1,234.56', 1234.56], // formato anglosajón
    ['1.234.567,89', 1234567.89],
    ['1,234,567.89', 1234567.89],
    ['12.345,6', 12345.6],
  ])('%s -> %s', (texto, esperado) => {
    expect(valor(texto)).toBeCloseTo(esperado as number, 6)
  })
})

describe('parsearNumero — un separador repetido: son miles', () => {
  it.each([
    ['1,234,567', 1234567],
    ['1.234.567', 1234567],
    ['12,345,678', 12345678],
  ])('%s -> %s', (texto, esperado) => {
    expect(valor(texto)).toBe(esperado)
  })
})

describe('parsearNumero — el espacio es separador de miles (fr, y NBSP de Intl)', () => {
  it.each([
    ['1 234,56', 1234.56],
    ['1 234,56', 1234.56], // espacio duro: lo que produce Intl en fr-FR
    ['1 234,56', 1234.56], // espacio fino
    ['1 234 567', 1234567],
  ])('%j -> %s', (texto, esperado) => {
    expect(valor(texto as string)).toBeCloseTo(esperado as number, 6)
  })
})

describe('parsearNumero — 🔴 el caso ambiguo se RECHAZA, no se adivina', () => {
  it.each([['1,234'], ['1.234'], ['12,345'], ['999.999']])(
    '%s pide desambiguar en vez de decidir sola',
    (texto) => {
      expect(valor(texto)).toBe('ERROR:ambiguo')
    },
  )

  it('con 4+ decimales ya no hay ambigüedad', () => {
    expect(valor('1,2345')).toBeCloseTo(1.2345, 9)
  })

  it('con 2 decimales tampoco', () => {
    expect(valor('1,23')).toBeCloseTo(1.23, 9)
  })

  it('sin parte entera no hay ambigüedad: es decimal', () => {
    expect(valor(',234')).toBeCloseTo(0.234, 9)
  })

  it('un cero delante desambigua hacia decimal', () => {
    expect(valor('0,234')).toBeCloseTo(0.234, 9)
  })
})

describe('parsearNumero — signo', () => {
  it.each([
    ['-1,5', -1.5],
    ['-1.234,56', -1234.56],
    ['+2,5', 2.5],
  ])('%s -> %s', (texto, esperado) => {
    expect(valor(texto)).toBeCloseTo(esperado as number, 6)
  })
})

describe('parsearNumero — entradas que no son números', () => {
  it.each([
    ['', 'ERROR:vacio'],
    ['   ', 'ERROR:vacio'],
    ['abc', 'ERROR:invalido'],
    ['1,2,3', 'ERROR:invalido'], // grupos de miles mal formados
    ['1.2.3', 'ERROR:invalido'],
    ['1,23,456', 'ERROR:invalido'],
    ['--1', 'ERROR:invalido'],
    ['1e5', 'ERROR:invalido'],
    [',', 'ERROR:invalido'],
    ['.', 'ERROR:invalido'],
    ['$1,5', 'ERROR:invalido'],
    ['1,5%', 'ERROR:invalido'],
  ])('%j -> %s', (texto, esperado) => {
    expect(valor(texto as string)).toBe(esperado)
  })
})

describe('lecturasAmbiguas — para preguntar con números, no con reglas', () => {
  it.each([
    ['1,234', 1.234, 1234],
    ['1.234', 1.234, 1234],
    ['12,345', 12.345, 12345],
    ['999.999', 999.999, 999999],
  ])('%s -> ¿%s o %s?', (texto, decimal, miles) => {
    expect(lecturasAmbiguas(texto as string)).toEqual({ decimal, miles })
  })

  it.each([['1,5'], ['1.234,56'], ['abc'], ['']])('%j no es ambiguo, no hay nada que preguntar', (texto) => {
    expect(lecturasAmbiguas(texto as string)).toBeUndefined()
  })
})

describe('parsearNumero — no pierde precisión donde importa', () => {
  it('1 satoshi sobrevive escrito con coma', () => {
    expect(valor('0,00000001')).toBe(1e-8)
  })

  it('un importe grande con miles y decimales', () => {
    expect(valor('1.234.567,89')).toBeCloseTo(1234567.89, 6)
  })

  it('🔴 el caso que producía 100× de error ya no lo produce', () => {
    // Antes: Chromium se comía la coma y devolvía 123456.
    expect(valor('1234,56')).toBeCloseTo(1234.56, 6)
  })
})
