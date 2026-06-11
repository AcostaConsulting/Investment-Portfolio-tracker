/** Utilidades de fechas sobre strings ISO `YYYY-MM-DD`, siempre en UTC. */

const MS_POR_DIA = 86_400_000

export function aUtc(fechaIso: string): number {
  const [a, m, d] = fechaIso.split('-').map(Number)
  if (!a || !m || !d) throw new Error(`Fecha inválida: ${fechaIso}`)
  return Date.UTC(a, m - 1, d)
}

/** Días completos entre dos fechas ISO (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA)
}

/** Suma días a una fecha ISO y regresa otra fecha ISO. */
export function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(aUtc(fechaIso) + dias * MS_POR_DIA)
  return fecha.toISOString().slice(0, 10)
}

/** Fecha ISO de hoy (hora local del equipo del usuario). */
export function hoyIso(): string {
  const ahora = new Date()
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  const d = String(ahora.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function esFechaIsoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(valor + 'T00:00:00Z')
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}

/** Comparador estable para ordenar operaciones: por fecha y luego por id. */
export function compararPorFecha(a: { fecha: string; id: string }, b: { fecha: string; id: string }): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
