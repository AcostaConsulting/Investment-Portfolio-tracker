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

async function preciosAcciones(
  simbolos: string[],
): Promise<Record<string, { precio: number; moneda: string }>> {
  if (simbolos.length === 0) return {}
  const datos = (await json(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(simbolos.join(','))}`,
  )) as { quoteResponse?: { result?: { symbol: string; regularMarketPrice?: number; currency?: string }[] } }
  const resultado: Record<string, { precio: number; moneda: string }> = {}
  for (const fila of datos.quoteResponse?.result ?? []) {
    if (fila.regularMarketPrice !== undefined && fila.currency) {
      resultado[fila.symbol] = { precio: fila.regularMarketPrice, moneda: fila.currency.toUpperCase() }
    }
  }
  return resultado
}

async function tipoCambio(de: string, a: string): Promise<number | undefined> {
  const datos = (await json(`https://api.frankfurter.dev/v1/latest?base=${de}&symbols=${a}`)) as {
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
