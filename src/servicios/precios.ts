/**
 * Precios en vivo — SOLO se ejecuta si el usuario activó el opt-in.
 * Toda petición pasa por el proxy del proceso main con lista blanca.
 *
 * Fuentes: CoinGecko (cripto), Yahoo Finance (acciones), Frankfurter (FX).
 */

import type { DocumentoStore } from '../state/documento'
import type { PrecioActual } from '../engine/tipos'
import { hoyIso } from '../engine/fechas'

/** Mapa símbolo → id de CoinGecko para las criptos más comunes. */
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  POL: 'matic-network',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
}

export interface ResultadoActualizacion {
  preciosNuevos: Record<string, PrecioActual>
  tiposCambioNuevos: Record<string, number>
  errores: string[]
}

async function json(url: string): Promise<unknown> {
  const respuesta = await window.api?.red.json(url)
  if (!respuesta?.ok) throw new Error(respuesta?.error ?? 'sin red')
  return respuesta.datos
}

async function preciosCripto(simbolos: string[], monedaBase: string): Promise<Record<string, number>> {
  const ids = simbolos
    .map((s) => COINGECKO_IDS[s] ?? s.toLowerCase())
    .filter((v, i, arr) => arr.indexOf(v) === i)
  if (ids.length === 0) return {}
  const vs = monedaBase.toLowerCase()
  const datos = (await json(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${vs}`,
  )) as Record<string, Record<string, number>>
  const resultado: Record<string, number> = {}
  for (const simbolo of simbolos) {
    const id = COINGECKO_IDS[simbolo] ?? simbolo.toLowerCase()
    const precio = datos[id]?.[vs]
    if (precio !== undefined) resultado[simbolo] = precio
  }
  return resultado
}

const HOST_YAHOO = 'https://query1.finance.yahoo.com'

export interface PrecioAccion {
  precio: number
  moneda: string
}

/** Parser PURO de la respuesta del endpoint v7/finance/quote (lote). */
export function parseQuoteV7(datos: unknown): Record<string, PrecioAccion> {
  const d = (datos ?? {}) as {
    quoteResponse?: { result?: { symbol?: string; regularMarketPrice?: number; currency?: string }[] }
  }
  const resultado: Record<string, PrecioAccion> = {}
  for (const fila of d.quoteResponse?.result ?? []) {
    if (fila.symbol && fila.regularMarketPrice !== undefined && fila.currency) {
      resultado[fila.symbol] = { precio: fila.regularMarketPrice, moneda: fila.currency.toUpperCase() }
    }
  }
  return resultado
}

/** Parser PURO de la respuesta del endpoint v8/finance/chart/{symbol} (un activo). */
export function parseChartV8(datos: unknown): PrecioAccion | undefined {
  const meta = (
    (datos ?? {}) as { chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string } }[] } }
  ).chart?.result?.[0]?.meta
  if (!meta || meta.regularMarketPrice === undefined || !meta.currency) return undefined
  return { precio: meta.regularMarketPrice, moneda: meta.currency.toUpperCase() }
}

/**
 * Precios de acciones con fallback. Yahoo v7/quote empezó a exigir
 * cookies/crumb y responde "Unauthorized"; cuando falla, se usa el
 * endpoint v8/finance/chart/{symbol} (no requiere crumb), uno por activo.
 */
async function preciosAcciones(simbolos: string[]): Promise<Record<string, PrecioAccion>> {
  if (simbolos.length === 0) return {}
  // Intento 1: v7 quote — un solo request para todos los símbolos.
  try {
    const datos = await json(`${HOST_YAHOO}/v7/finance/quote?symbols=${encodeURIComponent(simbolos.join(','))}`)
    const resultado = parseQuoteV7(datos)
    const faltan = simbolos.filter((s) => !(s in resultado))
    if (faltan.length === 0) return resultado
    // v7 devolvió algunos pero no todos: completa los faltantes con v8.
    return { ...resultado, ...(await preciosAccionesV8(faltan)) }
  } catch {
    // v7 caído (típicamente Unauthorized): v8 para todos.
    return preciosAccionesV8(simbolos)
  }
}

/** Fallback: v8/finance/chart por símbolo, tolerando fallas individuales. */
async function preciosAccionesV8(simbolos: string[]): Promise<Record<string, PrecioAccion>> {
  const entradas = await Promise.all(
    simbolos.map(async (simbolo) => {
      try {
        const datos = await json(
          `${HOST_YAHOO}/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1d&interval=1d`,
        )
        const precio = parseChartV8(datos)
        return precio ? ([simbolo, precio] as const) : null
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(entradas.filter((e): e is NonNullable<typeof e> => e !== null))
}

async function tipoCambio(de: string, a: string): Promise<number | undefined> {
  const datos = (await json(`https://api.frankfurter.dev/v1/latest?base=${de}&symbols=${a}`)) as {
    rates?: Record<string, number>
  }
  return datos.rates?.[a]
}

/**
 * Tipo de cambio HISTÓRICO de Frankfurter para una fecha dada (B8 del spec S2).
 * Frankfurter regresa el dato del día hábil más cercano anterior.
 */
export async function tipoCambioHistorico(
  fechaIso: string,
  de: string,
  a: string,
): Promise<number | undefined> {
  if (de === a) return 1
  const datos = (await json(`https://api.frankfurter.dev/v1/${fechaIso}?base=${de}&symbols=${a}`)) as {
    rates?: Record<string, number>
  }
  return datos.rates?.[a]
}

/** Actualiza precios de todos los activos y los tipos de cambio en uso. */
export async function actualizarTodo(doc: DocumentoStore): Promise<ResultadoActualizacion> {
  const errores: string[] = []
  const preciosNuevos: Record<string, PrecioActual> = {}
  const tiposCambioNuevos: Record<string, number> = {}
  const base = doc.ajustes.monedaBase
  const hoy = hoyIso()

  const criptos = doc.activos.filter((a) => a.clase === 'cripto')
  const acciones = doc.activos.filter((a) => a.clase === 'accion')

  // Cripto: CoinGecko cotiza directo en la moneda base del usuario.
  if (criptos.length > 0) {
    try {
      const precios = await preciosCripto(
        criptos.map((a) => a.simbolo),
        base,
      )
      for (const activo of criptos) {
        const precio = precios[activo.simbolo]
        if (precio !== undefined) {
          preciosNuevos[activo.id] = { precio, moneda: base, actualizado: hoy }
        }
      }
    } catch (e) {
      errores.push(`CoinGecko: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  // Acciones: Yahoo regresa el precio en la moneda de su mercado.
  if (acciones.length > 0) {
    try {
      const precios = await preciosAcciones(acciones.map((a) => a.simbolo))
      for (const activo of acciones) {
        const dato = precios[activo.simbolo]
        if (dato) preciosNuevos[activo.id] = { ...dato, actualizado: hoy }
      }
    } catch (e) {
      errores.push(`Yahoo Finance: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  // FX: todas las monedas distintas de la base que aparecen en activos o precios.
  const monedas = new Set<string>()
  for (const activo of doc.activos) if (activo.moneda !== base) monedas.add(activo.moneda)
  for (const precio of Object.values({ ...doc.precios, ...preciosNuevos }))
    if (precio.moneda !== base) monedas.add(precio.moneda)
  for (const moneda of monedas) {
    try {
      const tc = await tipoCambio(moneda, base)
      if (tc !== undefined) tiposCambioNuevos[moneda] = tc
    } catch (e) {
      errores.push(`Frankfurter ${moneda}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return { preciosNuevos, tiposCambioNuevos, errores }
}

/** Cambio porcentual de un benchmark en un rango de días. */
export async function cambioBenchmark(indice: 'sp500' | 'btc', dias: number): Promise<number> {
  if (indice === 'btc') {
    const datos = (await json(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${dias}&interval=daily`,
    )) as { prices?: [number, number][] }
    const precios = datos.prices ?? []
    const primero = precios[0]?.[1]
    const ultimo = precios[precios.length - 1]?.[1]
    if (!primero || !ultimo) throw new Error('sin datos')
    return ((ultimo - primero) / primero) * 100
  }
  const rango = dias <= 31 ? '1mo' : dias <= 95 ? '3mo' : '1y'
  const datos = (await json(
    `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=${rango}&interval=1d`,
  )) as { chart?: { result?: { indicators?: { quote?: { close?: (number | null)[] }[] } }[] } }
  const cierres = (datos.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(
    (c): c is number => c !== null,
  )
  const primero = cierres[0]
  const ultimo = cierres[cierres.length - 1]
  if (!primero || !ultimo) throw new Error('sin datos')
  return ((ultimo - primero) / primero) * 100
}
