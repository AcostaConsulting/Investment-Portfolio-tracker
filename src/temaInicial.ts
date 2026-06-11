/**
 * Aplica el tema ANTES del primer render para evitar el flash.
 * Se importa primero en main.tsx; corre síncrono al cargar el bundle.
 * La preferencia real vive en el documento; localStorage('pt-tema')
 * es solo el caché de arranque.
 */

const guardado = localStorage.getItem('pt-tema')
const tema = guardado === 'claro' || guardado === 'oscuro' || guardado === 'sistema' ? guardado : 'oscuro'
const efectivo =
  tema === 'sistema'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'oscuro'
      : 'claro'
    : tema
document.documentElement.dataset.tema = efectivo

export {}
