/** Gestión de etiquetas personalizadas (crear, renombrar, recolorear, borrar). */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { Icono } from '../../ui/Icono'
import { useApp } from '../../state/store'

/** Paleta fija de colores de etiqueta (datos del usuario, no tokens de tema). */
const COLORES = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#a78bfa', '#94a3b8']

export function GestionEtiquetas({ alCerrar }: { alCerrar: () => void }) {
  const { t } = useTranslation()
  const etiquetas = useApp((s) => s.doc.etiquetas)
  const activos = useApp((s) => s.doc.activos)
  const guardarEtiqueta = useApp((s) => s.guardarEtiqueta)
  const eliminarEtiqueta = useApp((s) => s.eliminarEtiqueta)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES[0]!)

  function crear() {
    const limpio = nombre.trim()
    if (!limpio) return
    guardarEtiqueta({ id: crypto.randomUUID(), nombre: limpio, color })
    setNombre('')
  }

  function usos(id: string): number {
    return activos.filter((a) => a.etiquetaIds?.includes(id)).length
  }

  function confirmaEliminar(id: string) {
    if (window.confirm(t('clasificacion.confirmaEliminarEtiquetaConActivos', { activos: usos(id) }))) {
      eliminarEtiqueta(id)
    }
  }

  return (
    <Modal titulo={t('clasificacion.gestionEtiquetas')} abierto alCerrar={alCerrar}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={{ flex: 1 }}
          placeholder={t('clasificacion.nombreEtiqueta')}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && crear()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: c,
                border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <button className="btn btn-primario" onClick={crear} disabled={!nombre.trim()}>
          {t('comunes.agregar')}
        </button>
      </div>

      {etiquetas.length === 0 ? (
        <p className="mini suave">{t('clasificacion.sinEtiquetasCreadas')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {etiquetas.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="punto" style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
              <input
                value={e.nombre}
                style={{ flex: 1 }}
                onChange={(ev) => guardarEtiqueta({ ...e, nombre: ev.target.value })}
              />
              <div style={{ display: 'flex', gap: 3 }}>
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => guardarEtiqueta({ ...e, color: c })}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: c,
                      border: e.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <span className="mini suave">{usos(e.id)}</span>
              <button className="btn-icono peligro" onClick={() => confirmaEliminar(e.id)}>
                <Icono nombre="basura" tam={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
