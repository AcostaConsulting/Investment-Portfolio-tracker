/**
 * Primeras pruebas de la capa de persistencia.
 *
 * `electron/` estuvo fuera del glob de Vitest hasta el 10 ago, así que este
 * archivo —el que decide si el usuario conserva su portafolio— no tenía **ni
 * una** prueba. Tres de los cinco P0 de la auditoría vivían aquí (§21.5).
 *
 * Este bloque se escribió y se corrió en VERDE **contra el código de antes**
 * del cambio de contrato de `cargar()`, con la misma disciplina de §13.3: la
 * red se tiende primero, para que respalde que lo que no debía moverse no se
 * movió. Por eso las aserciones de ida y vuelta miran el ARCHIVO en disco y no
 * el valor de retorno de `cargar()`, que sí cambia a propósito.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let dirPrueba = ''

vi.mock('electron', () => ({
  app: { getPath: () => dirPrueba },
}))

const { cargar, guardar, leerRespaldo, prepararRecuperacion, respaldar, leerZoom, guardarZoom } =
  await import('./almacen')

const rutaDatos = () => path.join(dirPrueba, 'datos.json')
const rutaRespaldos = () => path.join(dirPrueba, 'respaldos')

const DOC = {
  version: 1,
  activos: [{ id: 'a1', simbolo: 'TEST', nombre: 'Prueba', clase: 'accion', moneda: 'MXN' }],
  operaciones: [
    { id: 'o1', activoId: 'a1', tipo: 'compra', fecha: '2026-01-15', cantidad: 100, precioUnitario: 50, moneda: 'MXN', tipoCambio: 1 },
  ],
  onboardingCompletado: true,
}

beforeEach(() => {
  dirPrueba = mkdtempSync(path.join(tmpdir(), 'almacen-test-'))
})
afterEach(() => {
  rmSync(dirPrueba, { recursive: true, force: true })
})

describe('guardar — escritura atómica', () => {
  it('escribe un JSON que se puede volver a leer, idéntico', async () => {
    await guardar(DOC)
    expect(JSON.parse(readFileSync(rutaDatos(), 'utf8'))).toEqual(DOC)
  })

  it('no deja ningún .tmp huérfano', async () => {
    await guardar(DOC)
    expect(readdirSync(dirPrueba).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('sobrescribir no deja el archivo a medias ni mezcla contenidos', async () => {
    await guardar({ ...DOC, operaciones: Array.from({ length: 500 }, (_, i) => ({ id: `o${i}` })) })
    const grande = readFileSync(rutaDatos(), 'utf8')
    await guardar({ version: 1, activos: [], operaciones: [] })
    const chico = readFileSync(rutaDatos(), 'utf8')
    expect(chico.length).toBeLessThan(grande.length)
    // Si el rename no fuera atómico, quedarían restos del documento anterior.
    expect(() => JSON.parse(chico)).not.toThrow()
    expect(JSON.parse(chico).operaciones).toEqual([])
  })

  it('propaga el error si el destino no se puede escribir', async () => {
    // Un directorio donde debería ir el archivo: writeFile falla con EISDIR.
    mkdirSync(rutaDatos(), { recursive: true })
    await expect(guardar(DOC)).rejects.toThrow()
  })
})

describe('respaldar — anillo rotativo de 10', () => {
  it('copia el documento vigente a respaldos/', async () => {
    await guardar(DOC)
    await respaldar()
    const copias = readdirSync(rutaRespaldos())
    expect(copias).toHaveLength(1)
    expect(JSON.parse(readFileSync(path.join(rutaRespaldos(), copias[0]!), 'utf8'))).toEqual(DOC)
  })

  it('conserva como mucho 10 y borra los más viejos', async () => {
    await guardar(DOC)
    mkdirSync(rutaRespaldos(), { recursive: true })
    for (let i = 1; i <= 14; i++) {
      writeFileSync(path.join(rutaRespaldos(), `datos-2026-01-${String(i).padStart(2, '0')}T00-00-00.json`), '{}', 'utf8')
    }
    await respaldar()
    const quedan = readdirSync(rutaRespaldos()).sort()
    expect(quedan).toHaveLength(10)
    // Se van los más viejos por orden de nombre, que es orden cronológico.
    expect(quedan).not.toContain('datos-2026-01-01T00-00-00.json')
    expect(quedan).toContain('datos-2026-01-14T00-00-00.json')
  })

  it('respalda el archivo TAL CUAL, aunque esté corrupto', async () => {
    // Es lo que salva la evidencia cuando el documento se sobrescribe.
    writeFileSync(rutaDatos(), '{"version":1,"operac', 'utf8')
    await respaldar()
    const copias = readdirSync(rutaRespaldos())
    expect(copias).toHaveLength(1)
    expect(readFileSync(path.join(rutaRespaldos(), copias[0]!), 'utf8')).toBe('{"version":1,"operac')
  })

  it('no lanza si todavía no hay documento', async () => {
    await expect(respaldar()).resolves.toBeUndefined()
  })
})

describe('prefs.json — persistencia aparte del documento', () => {
  it('guarda y lee el zoom sin tocar datos.json', async () => {
    await guardar(DOC)
    const antes = readFileSync(rutaDatos(), 'utf8')
    await guardarZoom(1.4)
    expect(await leerZoom()).toBe(1.4)
    expect(readFileSync(rutaDatos(), 'utf8')).toBe(antes)
    expect(existsSync(path.join(dirPrueba, 'prefs.json'))).toBe(true)
  })

  it('devuelve undefined si no hay prefs o están corruptas', async () => {
    expect(await leerZoom()).toBeUndefined()
    writeFileSync(path.join(dirPrueba, 'prefs.json'), 'no soy json', 'utf8')
    expect(await leerZoom()).toBeUndefined()
  })
})

describe('cargar — documento sano', () => {
  it('devuelve el documento que hay en disco', async () => {
    await guardar(DOC)
    const r = await cargar()
    // El contrato de retorno cambia en esta sesión; lo que no cambia es que un
    // documento sano se entrega íntegro.
    const documento = r !== null && typeof r === 'object' && 'estado' in r ? (r as { documento: unknown }).documento : r
    expect(documento).toEqual(DOC)
  })
})

// ============================================================================
// Contrato nuevo de `cargar()`. Antes devolvía `null` tanto para "no hay
// archivo" como para "hay archivo y no se pudo leer", y de esa confusión nacía
// el peor bug de la app (AUDITORIA-ROBUSTEZ.md §1.3).
// ============================================================================

describe('cargar — distingue "no hay archivo" de "no se pudo leer"', () => {
  it('sin archivo devuelve `vacio` (y eso sí es primer uso)', async () => {
    expect(await cargar()).toEqual({ estado: 'vacio' })
  })

  it('con documento sano devuelve `ok`', async () => {
    await guardar(DOC)
    const r = await cargar()
    expect(r.estado).toBe('ok')
    if (r.estado === 'ok') expect(r.documento).toEqual(DOC)
  })

  it.each([
    ['truncado', '{"version":1,"activos":[{"id"'],
    ['cero bytes', ''],
    ['basura', 'no soy json'],
    ['BOM', '\uFEFF{"version":1}'],
  ])('%s devuelve `ilegible`, NUNCA `vacio`', async (_nombre, contenido) => {
    writeFileSync(rutaDatos(), contenido, 'utf8')
    const r = await cargar()
    expect(r.estado).toBe('ilegible')
  })

  it('copia el archivo ilegible ANTES de que nadie pueda tocarlo', async () => {
    writeFileSync(rutaDatos(), '{"version":1,"activos":[{"id"', 'utf8')
    const r = await cargar()
    expect(r.estado).toBe('ilegible')
    if (r.estado !== 'ilegible') return
    expect(r.copia).toBeTruthy()
    // La copia es idéntica al original y NO vive en respaldos/ (esa carpeta rota).
    expect(readFileSync(r.copia!, 'utf8')).toBe('{"version":1,"activos":[{"id"')
    expect(path.dirname(r.copia!)).toBe(dirPrueba)
  })

  it('🔴 NO cae a un respaldo por su cuenta: eso lo decide el usuario', async () => {
    // Antes `cargar()` devolvía el respaldo en silencio y el usuario podía
    // llevar días trabajando sobre datos viejos sin enterarse (hallazgo #9).
    await guardar(DOC)
    await respaldar()
    writeFileSync(rutaDatos(), 'roto', 'utf8')
    const r = await cargar()
    expect(r.estado).toBe('ilegible')
    if (r.estado !== 'ilegible') return
    // El respaldo se OFRECE, con lo que hace falta para elegirlo.
    expect(r.respaldos).toHaveLength(1)
    expect(r.respaldos[0]).toMatchObject({ legible: true, activos: 1, operaciones: 1 })
    expect(r.respaldos[0]!.fechaIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })

  it('marca los respaldos que tampoco se pueden leer', async () => {
    writeFileSync(rutaDatos(), 'roto', 'utf8')
    mkdirSync(rutaRespaldos(), { recursive: true })
    writeFileSync(path.join(rutaRespaldos(), 'datos-2026-01-01T00-00-00.json'), 'tambien roto', 'utf8')
    const r = await cargar()
    if (r.estado !== 'ilegible') throw new Error('debía ser ilegible')
    expect(r.respaldos[0]).toMatchObject({ legible: false, activos: null, operaciones: null })
  })

  it('ordena los respaldos del más nuevo al más viejo', async () => {
    writeFileSync(rutaDatos(), 'roto', 'utf8')
    mkdirSync(rutaRespaldos(), { recursive: true })
    for (const d of ['01', '05', '03']) {
      writeFileSync(path.join(rutaRespaldos(), `datos-2026-01-${d}T00-00-00.json`), JSON.stringify(DOC), 'utf8')
    }
    const r = await cargar()
    if (r.estado !== 'ilegible') throw new Error('debía ser ilegible')
    expect(r.respaldos.map((x) => x.nombre)).toEqual([
      'datos-2026-01-05T00-00-00.json',
      'datos-2026-01-03T00-00-00.json',
      'datos-2026-01-01T00-00-00.json',
    ])
  })
})

describe('leerRespaldo — el nombre viene del renderer, así que se acota', () => {
  it('lee un respaldo real', async () => {
    await guardar(DOC)
    await respaldar()
    const nombre = readdirSync(rutaRespaldos())[0]!
    const r = await leerRespaldo(nombre)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.documento).toEqual(DOC)
  })

  it.each([
    '../datos.json',
    '..\\..\\Windows\\win.ini',
    'C:\\Windows\\win.ini',
    'no-existe.json',
  ])('rechaza %s', async (nombre) => {
    await guardar(DOC)
    await respaldar()
    const r = await leerRespaldo(nombre)
    expect(r.ok).toBe(false)
  })

  it('avisa si el respaldo elegido tampoco parsea', async () => {
    mkdirSync(rutaRespaldos(), { recursive: true })
    writeFileSync(path.join(rutaRespaldos(), 'datos-2026-01-01T00-00-00.json'), 'roto', 'utf8')
    const r = await leerRespaldo('datos-2026-01-01T00-00-00.json')
    expect(r.ok).toBe(false)
  })
})

describe('prepararRecuperacion — para el caso "parsea pero la forma es inútil"', () => {
  it('copia el archivo y lista los respaldos', async () => {
    writeFileSync(rutaDatos(), '{"activos":"no soy un arreglo"}', 'utf8')
    await respaldar()
    const r = await prepararRecuperacion()
    expect(r.copia).toBeTruthy()
    expect(r.bytes).toBeGreaterThan(0)
    expect(r.respaldos).toHaveLength(1)
  })
})
