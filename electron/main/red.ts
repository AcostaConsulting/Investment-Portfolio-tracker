/**
 * Proxy de red del proceso main. Es el ÚNICO punto de la app que toca
 * internet, y solo cuando el usuario activó "precios en vivo" (opt-in).
 *
 * Lista blanca de hosts: nada más puede consultarse, punto.
 */

const HOSTS_PERMITIDOS = new Set([
  'api.coingecko.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'api.frankfurter.dev',
  'api.frankfurter.app',
])

export interface RespuestaRed {
  ok: boolean
  estado: number
  /** Cuerpo JSON ya parseado, o mensaje de error. */
  datos?: unknown
  error?: string
}

export async function obtenerJson(url: string): Promise<RespuestaRed> {
  let parseada: URL
  try {
    parseada = new URL(url)
  } catch {
    return { ok: false, estado: 0, error: 'URL inválida' }
  }
  if (parseada.protocol !== 'https:' || !HOSTS_PERMITIDOS.has(parseada.hostname)) {
    return { ok: false, estado: 0, error: `Host no permitido: ${parseada.hostname}` }
  }
  try {
    const respuesta = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'TrackerPortafolio/desktop' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!respuesta.ok) return { ok: false, estado: respuesta.status, error: respuesta.statusText }
    return { ok: true, estado: respuesta.status, datos: await respuesta.json() }
  } catch (error) {
    return { ok: false, estado: 0, error: error instanceof Error ? error.message : 'Error de red' }
  }
}
