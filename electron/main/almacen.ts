/**
 * Almacén en disco: un solo documento JSON con escritura atómica y
 * respaldos rotativos. Vive en userData, junto a los datos del usuario:
 * nada sale del equipo.
 */

import { app } from 'electron'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const NOMBRE_DATOS = 'datos.json'
const NOMBRE_PREFS = 'prefs.json'
const CARPETA_RESPALDOS = 'respaldos'
// 10 respaldos: cada copia es un JSON pequeño y el respaldo se hace como mucho
// una vez cada 10 min (ver index.ts), así que 10 cubre varios días de historia
// sin llenar el disco. Los más viejos se rotan.
const MAX_RESPALDOS = 10

function rutaDatos(): string {
  return path.join(app.getPath('userData'), NOMBRE_DATOS)
}

function carpetaRespaldos(): string {
  return path.join(app.getPath('userData'), CARPETA_RESPALDOS)
}

function rutaPrefs(): string {
  return path.join(app.getPath('userData'), NOMBRE_PREFS)
}

/**
 * Preferencias locales de la máquina (no del portafolio): viven aparte de
 * `datos.json` para no competir con su guardado ni viajar con un respaldo.
 */
export async function leerZoom(): Promise<number | undefined> {
  try {
    const prefs = JSON.parse(await readFile(rutaPrefs(), 'utf8'))
    return typeof prefs?.zoom === 'number' ? prefs.zoom : undefined
  } catch {
    return undefined
  }
}

export async function guardarZoom(zoom: number): Promise<void> {
  try {
    await writeFile(rutaPrefs(), JSON.stringify({ zoom }), 'utf8')
  } catch {
    // Mejor-esfuerzo: si no se puede persistir el zoom no es crítico.
  }
}

/** Lo que se sabe de un respaldo sin cargarlo: para que el usuario elija informado. */
export interface ResumenRespaldo {
  nombre: string
  /** Fecha ISO derivada del nombre del archivo, o '' si no se pudo. */
  fechaIso: string
  bytes: number
  /** null si el respaldo tampoco se puede leer. */
  activos: number | null
  operaciones: number | null
  legible: boolean
}

/**
 * Resultado de cargar. **`vacio` e `ilegible` son cosas distintas y de
 * confundirlas nacía el peor bug de la app** (AUDITORIA-ROBUSTEZ.md §1.3):
 * antes las dos devolvían `null`, la app arrancaba como primer uso y el primer
 * clic sobrescribía con un documento vacío un archivo que sí tenía datos.
 */
export type ResultadoCarga =
  | { estado: 'vacio' }
  | { estado: 'ok'; documento: unknown }
  | {
      estado: 'ilegible'
      error: string
      bytes: number
      /** Ruta de la copia de seguridad que se hizo ANTES de mostrar nada. */
      copia: string | null
      respaldos: ResumenRespaldo[]
    }

const RE_MARCA = /^datos-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.json$/

function fechaDeNombre(nombre: string): string {
  const m = RE_MARCA.exec(nombre)
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}` : ''
}

async function resumirRespaldos(): Promise<ResumenRespaldo[]> {
  const nombres = await listarRespaldos()
  const resumenes: ResumenRespaldo[] = []
  // Del más nuevo al más viejo: es el orden en que el usuario quiere elegir.
  for (const nombre of [...nombres].reverse()) {
    const ruta = path.join(carpetaRespaldos(), nombre)
    let bytes = 0
    try {
      bytes = (await stat(ruta)).size
    } catch {
      continue
    }
    let activos: number | null = null
    let operaciones: number | null = null
    let legible = false
    try {
      const doc = JSON.parse(await readFile(ruta, 'utf8'))
      if (doc && typeof doc === 'object') {
        activos = Array.isArray(doc.activos) ? doc.activos.length : null
        operaciones = Array.isArray(doc.operaciones) ? doc.operaciones.length : null
        legible = activos !== null && operaciones !== null
      }
    } catch {
      legible = false
    }
    resumenes.push({ nombre, fechaIso: fechaDeNombre(nombre), bytes, activos, operaciones, legible })
  }
  return resumenes
}

/**
 * Copia el archivo ilegible ANTES de que nada pueda tocarlo. No va a
 * `respaldos/` a propósito: esa carpeta rota y borraría la evidencia.
 */
async function copiarIlegible(): Promise<string | null> {
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const destino = path.join(app.getPath('userData'), `datos-ilegible-${marca}.json`)
  try {
    await copyFile(rutaDatos(), destino)
    return destino
  } catch {
    return null
  }
}

/**
 * Carga el documento.
 *
 * **Nunca cae a un respaldo por su cuenta.** Antes lo hacía en silencio y el
 * usuario podía llevar días trabajando sobre datos viejos sin saberlo
 * (hallazgo #9). Ahora, si el archivo existe y no se puede leer, lo dice y
 * deja que el usuario elija con la información enfrente.
 */
export async function cargar(): Promise<ResultadoCarga> {
  let texto: string
  try {
    texto = await readFile(rutaDatos(), 'utf8')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { estado: 'vacio' }
    return {
      estado: 'ilegible',
      error: error instanceof Error ? error.message : 'No se pudo leer el archivo',
      bytes: 0,
      copia: await copiarIlegible(),
      respaldos: await resumirRespaldos(),
    }
  }
  try {
    const documento = JSON.parse(texto)
    // Se anota lo que acabamos de leer: es la referencia contra la que se
    // comparará antes de cada escritura. Recargar renueva la huella, que es
    // justo lo que hace la opción "descartar lo mío y recargar".
    await anotarHuella(texto)
    return { estado: 'ok', documento }
  } catch (error: unknown) {
    // Existe y tiene contenido, pero no es JSON: truncado, BOM, UTF-16, 0 bytes…
    return {
      estado: 'ilegible',
      error: error instanceof Error ? error.message : 'El archivo no es JSON válido',
      bytes: Buffer.byteLength(texto, 'utf8'),
      copia: await copiarIlegible(),
      respaldos: await resumirRespaldos(),
    }
  }
}

/**
 * Copia el documento y lista los respaldos, para cuando el archivo SÍ parsea
 * pero su forma es inutilizable — eso lo detecta el renderer (`revisarForma`),
 * no el parser, así que necesita pedir la copia por su cuenta.
 */
export async function prepararRecuperacion(): Promise<{
  copia: string | null
  bytes: number
  respaldos: ResumenRespaldo[]
}> {
  let bytes = 0
  try {
    bytes = (await stat(rutaDatos())).size
  } catch {
    bytes = 0
  }
  return { copia: await copiarIlegible(), bytes, respaldos: await resumirRespaldos() }
}

/**
 * Lee un respaldo concreto que el usuario eligió. El nombre viene del renderer,
 * así que se acota a la carpeta de respaldos y a la lista real: nada de rutas
 * arbitrarias (la superficie IPC no acepta rutas, y esto no es la excepción).
 */
export async function leerRespaldo(
  nombre: string,
): Promise<{ ok: true; documento: unknown } | { ok: false; error: string }> {
  const seguro = path.basename(nombre)
  const disponibles = await listarRespaldos()
  if (!disponibles.includes(seguro)) return { ok: false, error: 'Respaldo no encontrado' }
  try {
    return { ok: true, documento: JSON.parse(await readFile(path.join(carpetaRespaldos(), seguro), 'utf8')) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo leer el respaldo' }
  }
}

/**
 * Huella del archivo tal como lo dejamos la última vez que lo leímos o
 * escribimos. Es lo que permite saber si alguien más lo tocó por debajo.
 */
interface Huella {
  mtimeMs: number
  size: number
  sha256: string
}
let huella: Huella | undefined

function sha256De(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex')
}

async function anotarHuella(texto: string): Promise<void> {
  try {
    const s = await stat(rutaDatos())
    huella = { mtimeMs: s.mtimeMs, size: s.size, sha256: sha256De(texto) }
  } catch {
    huella = undefined
  }
}

/** Solo para las pruebas: olvida lo que creíamos que había en disco. */
export function olvidarHuella(): void {
  huella = undefined
}

export interface ConflictoGuardado {
  ok: false
  motivo: 'conflicto'
  /** Copia de lo que había en disco — el trabajo del OTRO. */
  copiaExterna: string
  /** Copia del documento en memoria — el trabajo del USUARIO. */
  copiaMia: string
  ruta: string
}

export type ResultadoGuardado = { ok: true } | ConflictoGuardado

/**
 * ¿Cambió el archivo desde que lo leímos o lo escribimos?
 *
 * Dos niveles, y el segundo es el que evita los falsos positivos:
 *  1. `stat` (0.057 ms sobre 1.37 MB) como puerta barata.
 *  2. Sólo si `stat` discrepa, se lee y se hashea (1.98 ms, 35x más caro).
 *     OneDrive toca la fecha al sincronizar aunque el contenido sea idéntico;
 *     sin este segundo nivel el aviso saltaría sin motivo, y un aviso que sale
 *     cuando no debe se aprende a ignorar.
 */
async function contenidoAjenoEnDisco(): Promise<string | undefined> {
  if (!huella) return undefined // Nunca cargamos: no hay nada que preservar.
  let s: Awaited<ReturnType<typeof stat>>
  try {
    s = await stat(rutaDatos())
  } catch {
    return undefined // Ya no existe: no hay trabajo ajeno que perder.
  }
  if (s.mtimeMs === huella.mtimeMs && s.size === huella.size) return undefined
  let texto: string
  try {
    texto = await readFile(rutaDatos(), 'utf8')
  } catch {
    return undefined // Si no se puede leer, el error real saldrá al escribir.
  }
  return sha256De(texto) === huella.sha256 ? undefined : texto
}

/**
 * Guarda con escritura atómica: tmp + rename, nunca un archivo a medias.
 *
 * 🔴 Y ya no escribe a ciegas. Antes sobrescribía lo que hubiera en disco sin
 * mirar; el 9 de agosto eso costó la corrección del TC del DOF en 22
 * operaciones del portafolio real, sin que nadie se enterara en un día
 * (handoff §27.5). El candado de instancia única (§22.2) no cubre esto: un
 * escritor externo al proceso —OneDrive, un antivirus, alguien copiando el
 * archivo a mano— no es una segunda instancia.
 *
 * Ante un conflicto se respaldan **las dos** versiones antes de devolver nada,
 * decida lo que decida el usuario después. El respaldo es lo que salvó el dato
 * en §27.5; no debe depender de que alguien elija bien bajo presión.
 */
export async function guardar(
  documento: unknown,
  opciones?: { forzar?: boolean },
): Promise<ResultadoGuardado> {
  const destino = rutaDatos()
  const texto = JSON.stringify(documento, null, 2)

  if (!opciones?.forzar) {
    const ajeno = await contenidoAjenoEnDisco()
    if (ajeno !== undefined) {
      const copias = await respaldarConflicto(ajeno, texto)
      return { ok: false, motivo: 'conflicto', ...copias, ruta: app.getPath('userData') }
    }
  }

  const temporal = destino + '.tmp'
  await writeFile(temporal, texto, 'utf8')
  await rename(temporal, destino)
  // Sin esto, el SIGUIENTE guardado se detectaría a sí mismo como intruso.
  await anotarHuella(texto)
  return { ok: true }
}

/**
 * Copia las dos versiones en conflicto antes de que nadie decida nada.
 *
 * ⚠️ El prefijo es `conflicto-`, NO `datos-`, a propósito: `listarRespaldos()`
 * filtra por `datos-*.json` y rota a 10, así que unos respaldos llamados
 * `datos-…` se los llevaría la rotación — justo la evidencia que hay que
 * conservar.
 */
async function respaldarConflicto(
  textoExterno: string,
  textoMio: string,
): Promise<{ copiaExterna: string; copiaMia: string }> {
  await mkdir(carpetaRespaldos(), { recursive: true })
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const copiaExterna = path.join(carpetaRespaldos(), `conflicto-${marca}-EXTERNO.json`)
  const copiaMia = path.join(carpetaRespaldos(), `conflicto-${marca}-MIO.json`)
  await writeFile(copiaExterna, textoExterno, 'utf8')
  await writeFile(copiaMia, textoMio, 'utf8')
  return { copiaExterna, copiaMia }
}

/** Copia el documento actual a la carpeta de respaldos y rota los viejos. */
export async function respaldar(): Promise<void> {
  const origen = rutaDatos()
  try {
    await mkdir(carpetaRespaldos(), { recursive: true })
    const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    await copyFile(origen, path.join(carpetaRespaldos(), `datos-${marca}.json`))
    const respaldos = await listarRespaldos()
    for (const viejo of respaldos.slice(0, Math.max(0, respaldos.length - MAX_RESPALDOS))) {
      await rm(path.join(carpetaRespaldos(), viejo), { force: true })
    }
  } catch {
    // Sin documento aún o sin permisos: el respaldo es mejor-esfuerzo,
    // nunca debe impedir guardar.
  }
}

async function listarRespaldos(): Promise<string[]> {
  try {
    const nombres = await readdir(carpetaRespaldos())
    return nombres.filter((n) => n.startsWith('datos-') && n.endsWith('.json')).sort()
  } catch {
    return []
  }
}
