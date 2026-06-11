/**
 * Almacén en disco: un solo documento JSON con escritura atómica y
 * respaldos rotativos. Vive en userData, junto a los datos del usuario:
 * nada sale del equipo.
 */

import { app } from 'electron'
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const NOMBRE_DATOS = 'datos.json'
const CARPETA_RESPALDOS = 'respaldos'
const MAX_RESPALDOS = 20

function rutaDatos(): string {
  return path.join(app.getPath('userData'), NOMBRE_DATOS)
}

function carpetaRespaldos(): string {
  return path.join(app.getPath('userData'), CARPETA_RESPALDOS)
}

/**
 * Carga el documento. Si el archivo principal está corrupto intenta el
 * respaldo más reciente. Regresa null si no hay nada (primer arranque).
 */
export async function cargar(): Promise<unknown | null> {
  try {
    const texto = await readFile(rutaDatos(), 'utf8')
    return JSON.parse(texto)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    // Archivo corrupto: intentar respaldos del más nuevo al más viejo.
    const respaldos = await listarRespaldos()
    for (const nombre of respaldos.reverse()) {
      try {
        const texto = await readFile(path.join(carpetaRespaldos(), nombre), 'utf8')
        return JSON.parse(texto)
      } catch {
        continue
      }
    }
    return null
  }
}

/** Guarda con escritura atómica: tmp + rename, nunca un archivo a medias. */
export async function guardar(documento: unknown): Promise<void> {
  const destino = rutaDatos()
  const temporal = destino + '.tmp'
  const texto = JSON.stringify(documento, null, 2)
  await writeFile(temporal, texto, 'utf8')
  await rename(temporal, destino)
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
