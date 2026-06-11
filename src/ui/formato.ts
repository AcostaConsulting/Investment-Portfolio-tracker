/** Formateo de cifras con Intl, sensible al idioma activo. */

import i18n from '../i18n'

const LOCALE_POR_IDIOMA: Record<string, string> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
  zh: 'zh-CN',
  ja: 'ja-JP',
}

function locale(): string {
  return LOCALE_POR_IDIOMA[i18n.language] ?? 'es-MX'
}

export function formatoMoneda(valor: number, moneda: string, decimales?: number): string {
  try {
    return new Intl.NumberFormat(locale(), {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: decimales ?? 2,
      maximumFractionDigits: decimales ?? 2,
    }).format(valor)
  } catch {
    // Moneda no ISO (p. ej. cripto como "USDT"): número + código.
    return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: decimales ?? 2 }).format(valor)} ${moneda}`
  }
}

/** Cantidades: hasta 8 decimales sin ceros de relleno (cripto-friendly). */
export function formatoCantidad(valor: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 8 }).format(valor)
}

export function formatoPct(valor: number, conSigno = false): string {
  const texto = new Intl.NumberFormat(locale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
  const signo = conSigno && valor > 0 ? '+' : ''
  return `${signo}${texto}%`
}

export function formatoFecha(fechaIso: string): string {
  const [a, m, d] = fechaIso.split('-').map(Number)
  if (!a || !m || !d) return fechaIso
  return new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(a, m - 1, d),
  )
}
