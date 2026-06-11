/** Diálogos nativos de archivo para respaldos y Excel. */

import { dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface FiltroArchivo {
  nombre: string
  extensiones: string[]
}

/** Pide ruta y guarda contenido (base64 para binarios, utf8 para texto). */
export async function guardarArchivo(
  ventana: BrowserWindow,
  opciones: { sugerido: string; filtros: FiltroArchivo[]; contenidoBase64: string },
): Promise<{ guardado: boolean; ruta?: string; error?: string }> {
  const resultado = await dialog.showSaveDialog(ventana, {
    defaultPath: opciones.sugerido,
    filters: opciones.filtros.map((f) => ({ name: f.nombre, extensions: f.extensiones })),
  })
  if (resultado.canceled || !resultado.filePath) return { guardado: false }
  try {
    await writeFile(resultado.filePath, Buffer.from(opciones.contenidoBase64, 'base64'))
    return { guardado: true, ruta: resultado.filePath }
  } catch (error) {
    return { guardado: false, error: error instanceof Error ? error.message : 'No se pudo guardar' }
  }
}

/** Abre un archivo y lo regresa en base64 (el renderer decide cómo leerlo). */
export async function abrirArchivo(
  ventana: BrowserWindow,
  opciones: { filtros: FiltroArchivo[] },
): Promise<{ abierto: boolean; nombre?: string; contenidoBase64?: string; error?: string }> {
  const resultado = await dialog.showOpenDialog(ventana, {
    properties: ['openFile'],
    filters: opciones.filtros.map((f) => ({ name: f.nombre, extensions: f.extensiones })),
  })
  const ruta = resultado.filePaths[0]
  if (resultado.canceled || !ruta) return { abierto: false }
  try {
    const contenido = await readFile(ruta)
    return { abierto: true, nombre: path.basename(ruta), contenidoBase64: contenido.toString('base64') }
  } catch (error) {
    return { abierto: false, error: error instanceof Error ? error.message : 'No se pudo abrir' }
  }
}
