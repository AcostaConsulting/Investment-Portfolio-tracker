/**
 * Lógica PURA de importación desde Excel: adivinar el mapeo de columnas y
 * convertir filas crudas en operaciones validadas. Sin exceljs ni DOM aquí,
 * para poder probarla a fondo.
 */

import type { TipoOperacion } from '../../engine/tipos'
import { esFechaIsoValida } from '../../engine/fechas'

export const CAMPOS_IMPORT = [
  'fecha',
  'simbolo',
  'tipo',
  'cantidad',
  'precio',
  'moneda',
  'tipoCambio',
  'comision',
  'nota',
] as const

export type CampoImport = (typeof CAMPOS_IMPORT)[number]

/** campo → índice de columna (0-based). */
export type Mapeo = Partial<Record<CampoImport, number>>

const SINONIMOS: Record<CampoImport, string[]> = {
  fecha: ['fecha', 'date', 'dia', 'día', 'fec'],
  simbolo: ['simbolo', 'símbolo', 'symbol', 'ticker', 'clave', 'activo', 'asset', 'instrumento'],
  tipo: ['tipo', 'type', 'operacion', 'operación', 'movimiento', 'side'],
  cantidad: ['cantidad', 'qty', 'quantity', 'titulos', 'títulos', 'unidades', 'shares', 'monto'],
  precio: ['precio', 'price', 'precio unitario', 'px', 'costo'],
  moneda: ['moneda', 'currency', 'divisa', 'ccy'],
  tipoCambio: ['tipo de cambio', 'tipocambio', 'tc', 'fx', 'exchange rate', 'cambio'],
  comision: ['comision', 'comisión', 'fee', 'commission', 'corretaje'],
  nota: ['nota', 'notas', 'note', 'notes', 'descripcion', 'descripción', 'comentario'],
}

const TIPOS: Record<string, TipoOperacion> = {
  compra: 'compra',
  buy: 'compra',
  venta: 'venta',
  sell: 'venta',
  dividendo: 'dividendo',
  dividend: 'dividendo',
  interes: 'interes',
  interés: 'interes',
  interest: 'interes',
  staking: 'staking',
  ajuste: 'ajuste',
  adjustment: 'ajuste',
  airdrop: 'airdrop',
  recompensa: 'recompensa',
  reward: 'recompensa',
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/** Adivina qué columna corresponde a cada campo a partir de los encabezados. */
export function adivinarMapeo(encabezados: (string | undefined)[]): Mapeo {
  const mapeo: Mapeo = {}
  encabezados.forEach((encabezado, indice) => {
    if (!encabezado) return
    const limpio = normalizar(encabezado)
    for (const campo of CAMPOS_IMPORT) {
      if (mapeo[campo] !== undefined) continue
      if (SINONIMOS[campo].some((s) => normalizar(s) === limpio)) {
        mapeo[campo] = indice
        return
      }
    }
  })
  return mapeo
}

/** Celda de exceljs a texto plano (cubre richText, hipervínculos y fórmulas). */
export function celdaATexto(celda: unknown): string {
  if (celda === null || celda === undefined) return ''
  if (celda instanceof Date) return celda.toISOString().slice(0, 10)
  if (typeof celda === 'object') {
    const c = celda as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string }
    if (c.richText) return c.richText.map((r) => r.text).join('')
    if (c.text !== undefined) return String(c.text)
    if (c.result !== undefined) return celdaATexto(c.result)
    return ''
  }
  return String(celda)
}

function aNumero(celda: unknown): number | undefined {
  if (typeof celda === 'number') return Number.isFinite(celda) ? celda : undefined
  const texto = celdaATexto(celda).replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '')
  if (texto === '') return undefined
  const numero = Number(texto.replace(',', '.'))
  return Number.isFinite(numero) ? numero : undefined
}

/** Fechas: Date de Excel, ISO, dd/mm/aaaa (México) o serial de Excel. */
export function aFechaIso(celda: unknown): string | undefined {
  if (celda instanceof Date) {
    if (Number.isNaN(celda.getTime())) return undefined
    return celda.toISOString().slice(0, 10)
  }
  if (typeof celda === 'number') {
    // Serial de Excel: días desde 1899-12-30.
    if (celda < 20000 || celda > 80000) return undefined
    const ms = Math.round((celda - 25569) * 86_400_000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  const texto = celdaATexto(celda).trim()
  if (esFechaIsoValida(texto)) return texto
  const ddmm = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto)
  if (ddmm) {
    const [, d, m, a] = ddmm
    const iso = `${a}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
    if (esFechaIsoValida(iso)) return iso
  }
  return undefined
}

export interface FilaImportada {
  fecha: string
  simbolo: string
  tipo: TipoOperacion
  cantidad: number
  precioUnitario: number
  moneda: string
  tipoCambio: number
  comision?: number
  nota?: string
}

export interface ErrorFila {
  /** Número de fila visible en Excel (la 1 es el encabezado). */
  fila: number
  error: string
}

export interface ResultadoConversion {
  validas: FilaImportada[]
  errores: ErrorFila[]
  simbolosNuevos: string[]
}

/**
 * Convierte las filas crudas (sin encabezado) según el mapeo.
 * `simbolosExistentes` en mayúsculas para detectar activos por crear.
 */
export function convertirFilas(
  filas: unknown[][],
  mapeo: Mapeo,
  monedaBase: string,
  simbolosExistentes: Set<string>,
): ResultadoConversion {
  const validas: FilaImportada[] = []
  const errores: ErrorFila[] = []
  const simbolosNuevos = new Set<string>()

  const celda = (fila: unknown[], campo: CampoImport): unknown =>
    mapeo[campo] !== undefined ? fila[mapeo[campo]!] : undefined

  filas.forEach((fila, i) => {
    const numFila = i + 2 // +1 por 0-based, +1 por el encabezado
    const vacia = fila.every((c) => c === null || c === undefined || celdaATexto(c).trim() === '')
    if (vacia) return

    const fecha = aFechaIso(celda(fila, 'fecha'))
    if (!fecha) return errores.push({ fila: numFila, error: 'fecha' })

    const simbolo = celdaATexto(celda(fila, 'simbolo')).trim().toUpperCase()
    if (!simbolo) return errores.push({ fila: numFila, error: 'simbolo' })

    const tipoTexto = normalizar(celdaATexto(celda(fila, 'tipo')))
    const tipo = TIPOS[tipoTexto]
    if (!tipo) return errores.push({ fila: numFila, error: 'tipo' })

    const cantidad = aNumero(celda(fila, 'cantidad'))
    if (cantidad === undefined || (tipo === 'ajuste' ? cantidad === 0 : cantidad <= 0))
      return errores.push({ fila: numFila, error: 'cantidad' })

    const precio = aNumero(celda(fila, 'precio'))
    if (precio === undefined || precio < 0) return errores.push({ fila: numFila, error: 'precio' })

    const moneda = (celdaATexto(celda(fila, 'moneda')).trim().toUpperCase() || monedaBase).slice(0, 5)

    let tipoCambio = aNumero(celda(fila, 'tipoCambio'))
    if (tipoCambio === undefined) {
      if (moneda === monedaBase) tipoCambio = 1
      else return errores.push({ fila: numFila, error: 'tipoCambio' })
    }
    if (!(tipoCambio > 0)) return errores.push({ fila: numFila, error: 'tipoCambio' })

    const comision = aNumero(celda(fila, 'comision'))
    const nota = celdaATexto(celda(fila, 'nota')).trim()

    if (!simbolosExistentes.has(simbolo)) simbolosNuevos.add(simbolo)
    validas.push({
      fecha,
      simbolo,
      tipo,
      cantidad,
      precioUnitario: precio,
      moneda,
      tipoCambio,
      ...(comision !== undefined && comision > 0 ? { comision } : {}),
      ...(nota ? { nota } : {}),
    })
  })

  return { validas, errores, simbolosNuevos: [...simbolosNuevos].sort() }
}
