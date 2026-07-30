/**
 * Pruebas de generación del libro de Excel. Se ejercita `exportarExcel` de
 * punta a punta: el .xlsx que sale se vuelve a leer con exceljs, así que lo
 * que se verifica es el archivo real, no una estructura intermedia.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type ExcelJS from 'exceljs'
import type { TFunction } from 'i18next'
import { exportarExcel, type HojaExcel } from './exportar'
import { calcularPortafolio } from '../../engine/portafolio'
import { documentoInicial, type DocumentoStore } from '../../state/documento'
import { hoyIso } from '../../engine/fechas'
import type { Activo, Operacion } from '../../engine/tipos'

// `t` devuelve la llave tal cual: así los encabezados esperados documentan de
// qué llave i18n sale cada columna.
const t = ((llave: string) => llave) as unknown as TFunction

const accionMxn: Activo = { id: 'amxl', simbolo: 'AMX', nombre: 'América Móvil', clase: 'accion', moneda: 'MXN' }
const accionUsd: Activo = { id: 'aapl', simbolo: 'AAPL', nombre: 'Apple', clase: 'accion', moneda: 'USD' }

function docConDatos(): DocumentoStore {
  const doc = documentoInicial()
  doc.activos = [accionMxn, accionUsd]
  doc.operaciones = [
    {
      id: 'op-1',
      activoId: 'amxl',
      tipo: 'compra',
      fecha: '2026-01-10',
      cantidad: 100,
      precioUnitario: 15.5,
      moneda: 'MXN',
      tipoCambio: 1,
    },
    {
      id: 'op-2',
      activoId: 'aapl',
      tipo: 'compra',
      fecha: '2026-02-20',
      cantidad: 10,
      precioUnitario: 100,
      moneda: 'USD',
      tipoCambio: 20,
      comision: 0,
      nota: 'primera compra',
    },
  ] satisfies Operacion[]
  doc.precios = {
    amxl: { precio: 18, moneda: 'MXN' },
    aapl: { precio: 200, moneda: 'USD' },
  }
  doc.tiposCambio = { USD: 20 }
  return doc
}

let guardado: { sugerido: string; contenidoBase64: string } | undefined

beforeEach(() => {
  guardado = undefined
  vi.stubGlobal('window', {
    api: {
      dialogo: {
        guardar: (opciones: { sugerido: string; contenidoBase64: string }) => {
          guardado = opciones
          return Promise.resolve({ guardado: true })
        },
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Exporta y vuelve a abrir el .xlsx generado. */
async function exportarYLeer(doc: DocumentoStore, hojas?: readonly HojaExcel[]) {
  const portafolio = calcularPortafolio(doc.activos, doc.operaciones, {
    monedaBase: doc.ajustes.monedaBase,
    hoy: '2026-07-30',
    precios: doc.precios,
    tiposCambio: doc.tiposCambio,
  })
  const ok = await exportarExcel(doc, portafolio, t, hojas)
  expect(ok).toBe(true)
  expect(guardado).toBeDefined()

  const { Workbook } = (await import('exceljs')).default ?? (await import('exceljs'))
  const libro = new Workbook()
  // exceljs lee de un ArrayBuffer, no del Buffer de Node.
  const bytes = Buffer.from(guardado!.contenidoBase64, 'base64')
  await libro.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  return { libro, sugerido: guardado!.sugerido }
}

/** Encabezados visibles de la fila 1 (exceljs indexa las celdas desde 1). */
function encabezados(hoja: ExcelJS.Worksheet): string[] {
  return (hoja.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? ''))
}

function fila(hoja: ExcelJS.Worksheet, n: number): unknown[] {
  return (hoja.getRow(n).values as unknown[]).slice(1)
}

function nombresHojas(libro: ExcelJS.Workbook): string[] {
  return libro.worksheets.map((h) => h.name)
}

describe('libro completo (el que exporta Movimientos)', () => {
  it('trae las tres hojas, en el mismo orden de siempre', async () => {
    const { libro } = await exportarYLeer(docConDatos())
    expect(nombresHojas(libro)).toEqual(['movimientos.titulo', 'posiciones.titulo', 'nav.resumen'])
  })

  it('la hoja de Movimientos conserva sus columnas y sus filas', async () => {
    const { libro } = await exportarYLeer(docConDatos())
    const hoja = libro.getWorksheet('movimientos.titulo')!
    expect(encabezados(hoja)).toEqual([
      'comunes.fecha',
      'comunes.simbolo',
      'comunes.tipo',
      'comunes.cantidad',
      'comunes.precio',
      'comunes.moneda',
      'formOperacion.tipoCambio',
      'comunes.comision',
      'movimientos.importeBase',
      'comunes.nota',
    ])
    // Ordenadas por fecha: primero AMX (10 ene), luego AAPL (20 feb).
    expect(fila(hoja, 2)).toEqual([
      '2026-01-10',
      'AMX',
      'operaciones.compra',
      100,
      15.5,
      'MXN',
      1,
      0,
      1550,
      '',
    ])
    expect(fila(hoja, 3)).toEqual([
      '2026-02-20',
      'AAPL',
      'operaciones.compra',
      10,
      100,
      'USD',
      20,
      0,
      20000,
      'primera compra',
    ])
  })

  it('la hoja de Resumen conserva sus siete renglones', async () => {
    const { libro } = await exportarYLeer(docConDatos())
    const hoja = libro.getWorksheet('nav.resumen')!
    const etiquetas = hoja.getColumn(1).values.slice(2).map(String)
    expect(etiquetas).toEqual([
      'resumen.valorTotal',
      'resumen.costoTotal',
      'resumen.pnlNoRealizado',
      'resumen.pnlRealizado',
      'resumen.ingresos',
      'analisis.comisionesTotal',
      'resumen.gananciaTotal',
    ])
    // AMX: 100 × 18 = 1,800 · AAPL: 10 × 200 USD × 20 = 40,000
    expect(hoja.getCell('B2').value).toBe(41800)
  })

  it('sugiere el nombre de archivo de siempre', async () => {
    const { sugerido } = await exportarYLeer(docConDatos())
    expect(sugerido).toBe(`tracker-portafolio-${hoyIso()}.xlsx`)
  })
})

describe('hoja de Posiciones', () => {
  it('incluye precio actual de mercado y % de peso', async () => {
    const { libro } = await exportarYLeer(docConDatos())
    const hoja = libro.getWorksheet('posiciones.titulo')!
    expect(encabezados(hoja)).toEqual([
      'comunes.simbolo',
      'comunes.nombre',
      'comunes.clase',
      'comunes.cantidad',
      'posiciones.precioPromedio (MXN)',
      'posiciones.precioActual',
      'comunes.moneda',
      'posiciones.valorActual (MXN)',
      'posiciones.pnl (MXN)',
      'posiciones.rendimiento',
      'posiciones.peso',
    ])
  })

  it('mapea los valores de las columnas nuevas', async () => {
    const { libro } = await exportarYLeer(docConDatos())
    const hoja = libro.getWorksheet('posiciones.titulo')!
    // AMX: 1,800 de 41,800 = 4.31% · precio de mercado 18 MXN
    expect(fila(hoja, 2)).toEqual(['AMX', 'América Móvil', 'clases.accion', 100, 15.5, 18, 'MXN', 1800, 250, 16.13, 4.31])
    // AAPL: 40,000 de 41,800 = 95.69% · precio de mercado 200 USD (no convertido)
    expect(fila(hoja, 3)).toEqual(['AAPL', 'Apple', 'clases.accion', 10, 2000, 200, 'USD', 40000, 20000, 100, 95.69])
  })

  it('deja el precio de mercado vacío cuando no hay precio capturado', async () => {
    const doc = docConDatos()
    doc.precios = {}
    const { libro } = await exportarYLeer(doc)
    const hoja = libro.getWorksheet('posiciones.titulo')!
    expect(fila(hoja, 2)[5]).toBeUndefined()
    expect(fila(hoja, 2)[6]).toBe('')
  })
})

describe('modo solo Posiciones', () => {
  it('genera un libro de una sola hoja', async () => {
    const { libro } = await exportarYLeer(docConDatos(), ['posiciones'])
    expect(nombresHojas(libro)).toEqual(['posiciones.titulo'])
  })

  it('usa un nombre de archivo distinto al del libro completo', async () => {
    const { sugerido } = await exportarYLeer(docConDatos(), ['posiciones'])
    expect(sugerido).toBe(`posiciones-${hoyIso()}.xlsx`)
    expect(sugerido).not.toBe(`tracker-portafolio-${hoyIso()}.xlsx`)
  })

  it('trae las mismas columnas que la hoja de Posiciones del libro completo', async () => {
    const solo = await exportarYLeer(docConDatos(), ['posiciones'])
    const completo = await exportarYLeer(docConDatos())
    expect(encabezados(solo.libro.getWorksheet('posiciones.titulo')!)).toEqual(
      encabezados(completo.libro.getWorksheet('posiciones.titulo')!),
    )
  })
})

describe('portafolio vacío', () => {
  it('genera el libro completo sin truenos, con las hojas y sus encabezados', async () => {
    const { libro } = await exportarYLeer(documentoInicial())
    expect(nombresHojas(libro)).toEqual(['movimientos.titulo', 'posiciones.titulo', 'nav.resumen'])
    const hoja = libro.getWorksheet('posiciones.titulo')!
    expect(encabezados(hoja)).toHaveLength(11)
    expect(hoja.rowCount).toBe(1)
  })

  it('genera el libro de solo Posiciones sin truenos', async () => {
    const { libro } = await exportarYLeer(documentoInicial(), ['posiciones'])
    expect(nombresHojas(libro)).toEqual(['posiciones.titulo'])
    expect(libro.getWorksheet('posiciones.titulo')!.rowCount).toBe(1)
  })
})

describe('metadatos del libro', () => {
  it('firma el archivo como Patrimo', async () => {
    const { libro } = await exportarYLeer(docConDatos())
    expect(libro.creator).toBe('Patrimo')
  })
})
