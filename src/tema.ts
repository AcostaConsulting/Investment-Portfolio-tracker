/** Aplica el tema (claro/oscuro/sistema) como atributo en <html>. */

import { useEffect } from 'react'
import type { Tema } from './state/documento'

function aplicar(tema: Tema): void {
  const efectivo =
    tema === 'sistema'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'oscuro'
        : 'claro'
      : tema
  document.documentElement.dataset.tema = efectivo
}

export function useTema(tema: Tema): void {
  useEffect(() => {
    aplicar(tema)
    if (tema !== 'sistema') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => aplicar('sistema')
    media.addEventListener('change', alCambiar)
    return () => media.removeEventListener('change', alCambiar)
  }, [tema])
}
