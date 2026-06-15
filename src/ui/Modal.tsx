import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icono } from './Icono'

export function Modal({
  titulo,
  abierto,
  alCerrar,
  children,
  pie,
  ancho,
}: {
  titulo: string
  abierto: boolean
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  /** Ancho máximo en px (default 560). */
  ancho?: number
}) {
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierto, alCerrar])

  if (!abierto) return null

  // Portal a <body>: un modal con position:fixed se rompe si algún ancestro
  // crea un containing block (transform/animación) o lo recorta con
  // overflow:hidden — justo lo que pasaba dentro de las secciones colapsables
  // de Análisis. Montándolo en body queda siempre relativo al viewport.
  return createPortal(
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div
        className="modal"
        role="dialog"
        aria-modal
        style={ancho ? { width: `min(${ancho}px, calc(100vw - 48px))` } : undefined}
      >
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={alCerrar} aria-label="✕">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
