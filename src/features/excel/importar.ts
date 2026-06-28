/**
 * Lógica PURA de importación desde Excel: adivinar el mapeo de columnas y
 * convertir filas crudas en operaciones validadas. Sin exceljs ni DOM aquí,
 * para poder probarla a fondo.
 */

import type { ClaseActivo, TipoOperacion } from '../../engine/tipos'
import { esFechaIsoValida } from '../../engine/fechas'

export const CAMPOS_IMPORT = [
  'fecha',
  'simbolo',
  'clase',
  'tipo',
  'cantidad',
  'precio',
  'importe',
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
  clase: ['clase', 'class', 'tipo de activo', 'asset class', 'categoria', 'categoría'],
  tipo: ['tipo', 'type', 'operacion', 'operación', 'movimiento', 'side'],
  cantidad: ['cantidad', 'qty', 'quantity', 'titulos', 'títulos', 'unidades', 'shares'],
  precio: ['precio', 'price', 'precio unitario', 'precio unit', 'precio usd', 'px', 'costo'],
  importe: ['importe', 'monto', 'amount', 'total', 'monto mxn', 'importe mxn', 'monto base', 'valor mxn'],
  moneda: ['moneda', 'currency', 'divisa', 'ccy'],
  tipoCambio: ['tipo de cambio', 'tipocambio', 'tipo cambio', 'tipo cambio op', 'tc', 'fx', 'exchange rate', 'cambio'],
  comision: ['comision', 'comisión', 'comision usd', 'comision mxn', 'fee', 'commission', 'corretaje'],
  nota: ['nota', 'notas', 'note', 'notes', 'descripcion', 'descripción', 'comentario'],
}

/** Texto de la columna Clase → clase interna del activo. */
const CLASES: Record<string, ClaseActivo> = {
  accion: 'accion',
  acciones: 'accion',
  stock: 'accion',
  stocks: 'accion',
  equity: 'accion',
  cripto: 'cripto',
  crypto: 'cripto',
  criptomoneda: 'cripto',
  criptomonedas: 'cripto',
  'renta fija': 'renta_fija',
  renta_fija: 'renta_fija',
  rentafija: 'renta_fija',
  'fixed income': 'renta_fija',
  bono: 'renta_fija',
  bonos: 'renta_fija',
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
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, ' ') // quita unidades entre paréntesis: "(USD)"
    .replace(/[.,;:]/g, ' ') // puntuación que separa palabras
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto de la columna Clase → clase interna, sin acentos y case-insensitive. */
export function normalizarClase(texto: string): ClaseActivo | undefined {
  return CLASES[normalizar(texto)]
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
  /** Clase leída del Excel (si la columna existía y era reconocible). */
  clase?: ClaseActivo
  tipo: TipoOperacion
  cantidad: number
  precioUnitario: number
  moneda: string
  tipoCambio: number
  /** Importe en efectivo (en `moneda`) para dividendo/interés. */
  importeEfectivo?: number
  comision?: number
  nota?: string
}

export interface OpcionesConversion {
  /** Moneda de las filas extranjeras cuando no hay columna de moneda (default USD). */
  monedaExtranjera?: string
  /** TC a usar cuando una fila extranjera no trae tipo de cambio (default 18.5). */
  tcPorDefecto?: number
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
  opciones: OpcionesConversion = {},
): ResultadoConversion {
  const monedaExtranjera = (opciones.monedaExtranjera ?? 'USD').toUpperCase()
  const tcPorDefecto = opciones.tcPorDefecto ?? 18.5
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

    const clase = normalizarClase(celdaATexto(celda(fila, 'clase')))
    const esEfectivo = tipo === 'dividendo' || tipo === 'interes'
    const esEnEspecie = tipo === 'staking' || tipo === 'airdrop' || tipo === 'recompensa'
    const esAjuste = tipo === 'ajuste'

    const cantidadRaw = aNumero(celda(fila, 'cantidad'))
    const precioRaw = aNumero(celda(fila, 'precio'))
    const monto = aNumero(celda(fila, 'importe')) // "Monto MXN": importe total en moneda base
    const tcCol = aNumero(celda(fila, 'tipoCambio'))
    const monedaCol = celdaATexto(celda(fila, 'moneda')).trim().toUpperCase()

    // --- cantidad: el flujo de efectivo (dividendo/interés) no mueve la posición ---
    let cantidad: number
    if (esEfectivo) {
      cantidad = 0
    } else {
      if (cantidadRaw === undefined || (esAjuste ? cantidadRaw === 0 : cantidadRaw <= 0))
        return errores.push({ fila: numFila, error: 'cantidad' })
      cantidad = cantidadRaw
    }

    // --- moneda y tipo de cambio ---
    // Con columna de moneda explícita se respeta; si no, se infiere: las filas de
    // acción/cripto con TC ≠ 1 se tratan como extranjeras (USD), el resto en base.
    let moneda: string
    let tipoCambio: number
    if (monedaCol) {
      moneda = monedaCol.slice(0, 5)
      const tc = tcCol ?? (moneda === monedaBase ? 1 : undefined)
      if (tc === undefined) return errores.push({ fila: numFila, error: 'tipoCambio' })
      tipoCambio = tc
    } else {
      const extranjera = clase
        ? (clase === 'accion' || clase === 'cripto') && tcCol !== 1
        : tcCol !== undefined && tcCol !== 1
      if (extranjera) {
        moneda = monedaExtranjera
        tipoCambio = tcCol ?? tcPorDefecto
      } else {
        moneda = monedaBase
        tipoCambio = 1
      }
    }
    if (!(tipoCambio > 0)) return errores.push({ fila: numFila, error: 'tipoCambio' })

    // --- precio unitario / importe en efectivo ---
    let precioUnitario = 0
    let importeEfectivo: number | undefined
    if (esEfectivo) {
      if (monto === undefined || !(monto > 0)) return errores.push({ fila: numFila, error: 'importe' })
      importeEfectivo = monto / tipoCambio // el monto está en base; lo paso a `moneda`
    } else if (precioRaw !== undefined && precioRaw >= 0) {
      precioUnitario = precioRaw
    } else if (monto !== undefined && cantidad > 0) {
      // Falta el precio pero hay monto y cantidad: lo derivo (ej. cripto comprado con MXN).
      precioUnitario = monto / tipoCambio / cantidad
    } else if (esEnEspecie || esAjuste) {
      precioUnitario = 0 // ingreso en especie / ajuste sin valor capturado
    } else {
      return errores.push({ fila: numFila, error: 'precio' })
    }

    const comision = esEfectivo ? undefined : aNumero(celda(fila, 'comision'))
    const nota = celdaATexto(celda(fila, 'nota')).trim()

    if (!simbolosExistentes.has(simbolo)) simbolosNuevos.add(simbolo)
    validas.push({
      fecha,
      simbolo,
      ...(clase ? { clase } : {}),
      tipo,
      cantidad,
      precioUnitario,
      moneda,
      tipoCambio,
      ...(importeEfectivo !== undefined ? { importeEfectivo } : {}),
      ...(comision !== undefined && comision > 0 ? { comision } : {}),
      ...(nota ? { nota } : {}),
    })
  })

  return { validas, errores, simbolosNuevos: [...simbolosNuevos].sort() }
}
