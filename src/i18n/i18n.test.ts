import { describe, expect, it } from 'vitest'
import { es } from './es'
import { en } from './en'
import { fr } from './fr'
import { zh } from './zh'
import { ja } from './ja'

type Arbol = Record<string, unknown>

function llaves(objeto: Arbol, prefijo = ''): string[] {
  return Object.entries(objeto).flatMap(([llave, valor]) =>
    typeof valor === 'object' && valor !== null
      ? llaves(valor as Arbol, `${prefijo}${llave}.`)
      : [`${prefijo}${llave}`],
  )
}

/** Placeholders {{x}} usados en un texto. */
function placeholders(texto: string): string[] {
  return [...texto.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort()
}

function valores(objeto: Arbol, prefijo = ''): [string, string][] {
  return Object.entries(objeto).flatMap(([llave, valor]) =>
    typeof valor === 'object' && valor !== null
      ? valores(valor as Arbol, `${prefijo}${llave}.`)
      : [[`${prefijo}${llave}`, String(valor)] as [string, string]],
  )
}

const IDIOMAS = { en, fr, zh, ja }
const llavesEs = llaves(es).sort()
const placeholdersEs = new Map(valores(es).map(([k, v]) => [k, placeholders(v)]))

describe('paridad de traducciones', () => {
  for (const [codigo, diccionario] of Object.entries(IDIOMAS)) {
    it(`${codigo} tiene exactamente las mismas llaves que es`, () => {
      expect(llaves(diccionario as Arbol).sort()).toEqual(llavesEs)
    })

    it(`${codigo} conserva los placeholders de interpolación`, () => {
      for (const [llave, texto] of valores(diccionario as Arbol)) {
        const esperados = placeholdersEs.get(llave)
        // Los plurales _one/_other pueden variar entre idiomas; el resto debe coincidir.
        if (esperados && !llave.includes('_')) {
          expect(placeholders(texto), `${codigo}:${llave}`).toEqual(esperados)
        }
      }
    })

    it(`${codigo} no dejó textos idénticos al español en llaves largas`, () => {
      // Heurística anti-"olvidé traducir": ningún texto > 25 chars debe ser
      // idéntico al español (los cortos como "Pro" o "PIN" sí coinciden).
      const textosEs = new Map(valores(es))
      const soloPlaceholders = (texto: string) => texto.replace(/\{\{\w+\}\}|\s/g, '') === ''
      const iguales = valores(diccionario as Arbol).filter(
        ([llave, texto]) => texto.length > 25 && textosEs.get(llave) === texto && !soloPlaceholders(texto),
      )
      expect(iguales.map(([k]) => k)).toEqual([])
    })
  }
})
