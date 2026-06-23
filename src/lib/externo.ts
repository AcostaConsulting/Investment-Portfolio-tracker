/**
 * Único camino para abrir links externos. Lista blanca HTTPS estricta:
 * cualquier URL fuera de ella simplemente no se abre. Sin mailto:.
 *
 * (El proceso main además rechaza todo lo que no sea https y lo manda
 * al navegador del sistema — esta capa evita llegar siquiera ahí.)
 */

const HOSTS_PERMITIDOS = new Set([
  'acostafconsulting.gumroad.com',
  'acostaconsulting.odoo.com',
  'franscisco-acosta.odoo.com',
  'github.com',
])

export function esUrlPermitida(url: string): boolean {
  try {
    const parseada = new URL(url)
    return parseada.protocol === 'https:' && HOSTS_PERMITIDOS.has(parseada.hostname)
  } catch {
    return false
  }
}

/** Abre la URL en el navegador del sistema si está en la lista blanca. */
export function abrirExterno(url: string): void {
  if (!esUrlPermitida(url)) return
  // window.open dispara el setWindowOpenHandler del main → shell.openExternal.
  window.open(url, '_blank', 'noopener')
}
