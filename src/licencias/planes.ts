/**
 * Planes y gating de funciones.
 *
 * Free es el plan por defecto (sin licencia). Lifetime equivale a Premium
 * pero sin vencimiento. El gating se define por nivel para que agregar una
 * capacidad nueva sea una sola línea.
 */

export type Plan = 'free' | 'pro' | 'premium' | 'lifetime'

export type Capacidad =
  | 'importarExcel'
  | 'exportarExcel'
  | 'preciosEnVivo'
  | 'alertasPrecio'
  | 'analisisComisiones'
  | 'liquidez'
  | 'rebalanceo'
  | 'benchmarks'
  | 'metas'
  | 'etiquetasIlimitadas'

const NIVEL_PLAN: Record<Plan, number> = {
  free: 0,
  pro: 1,
  premium: 2,
  lifetime: 2,
}

// Sesión 2: alertas, comisiones, liquidez y benchmarks bajaron a Pro.
const NIVEL_REQUERIDO: Record<Capacidad, number> = {
  importarExcel: 0,
  exportarExcel: 1,
  preciosEnVivo: 1,
  alertasPrecio: 1,
  analisisComisiones: 1,
  liquidez: 1,
  benchmarks: 1,
  rebalanceo: 2,
  metas: 2,
  etiquetasIlimitadas: 2,
}

export function tieneCapacidad(plan: Plan, capacidad: Capacidad): boolean {
  return NIVEL_PLAN[plan] >= NIVEL_REQUERIDO[capacidad]
}

/** Plan mínimo que desbloquea una capacidad (para el aviso de upgrade en la UI). */
export function planMinimoPara(capacidad: Capacidad): Plan {
  const nivel = NIVEL_REQUERIDO[capacidad]
  if (nivel <= 0) return 'free'
  if (nivel === 1) return 'pro'
  return 'premium'
}

export const PRECIOS_USD: Record<Exclude<Plan, 'free'>, { monto: number; tipo: 'unico' | 'mensual' }> = {
  pro: { monto: 24.99, tipo: 'unico' },
  premium: { monto: 6.99, tipo: 'mensual' },
  lifetime: { monto: 89.99, tipo: 'unico' },
}
