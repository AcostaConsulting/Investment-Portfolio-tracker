import { useEffect, type ReactNode } from 'react'
import { Icono } from './Icono'

export function Modal({
  titulo,
  abierto,
  alCerrar,
  children,
  pie,
}: {
  titulo: string
  abierto: boolean
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
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

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="modal" role="dialog" aria-modal>
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={alCerrar} aria-label="✕">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  )
}
