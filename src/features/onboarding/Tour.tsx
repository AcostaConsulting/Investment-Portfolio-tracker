/**
 * Tour guiado con spotlight: oscurece la app y recorta un halo sobre el
 * elemento del nav correspondiente, con el tooltip a un costado.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'

const PASOS = ['resumen', 'posiciones', 'movimientos', 'rentafija', 'analisis'] as const

const TEXTO: Record<
  (typeof PASOS)[number],
  'tour.resumen' | 'tour.posiciones' | 'tour.movimientos' | 'tour.rentaFija' | 'tour.analisis'
> = {
  resumen: 'tour.resumen',
  posiciones: 'tour.posiciones',
  movimientos: 'tour.movimientos',
  rentafija: 'tour.rentaFija',
  analisis: 'tour.analisis',
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function Tour() {
  const { t } = useTranslation()
  const completarTour = useApp((s) => s.completarTour)
  const [paso, setPaso] = useState(0)
  const [rect, setRect] = useState<Rect | undefined>()
  const terminado = paso >= PASOS.length

  useEffect(() => {
    if (terminado) {
      setRect(undefined)
      return
    }
    function medir() {
      const el = document.querySelector(`[data-tour="${PASOS[paso]}"]`)
      if (!el) return setRect(undefined)
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [paso, terminado])

  const tooltipTop = rect ? Math.min(rect.top, window.innerHeight - 190) : undefined

  return (
    <div className="tour-capa">
      {rect && (
        <div
          className="tour-spotlight"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}

      <div
        className="tour-tooltip tarjeta"
        style={rect ? { top: tooltipTop, left: rect.left + rect.width + 16 } : { bottom: 22, right: 22 }}
      >
        {terminado ? (
          <>
            <strong>{t('tour.finTitulo')}</strong>
            <p className="mini suave" style={{ margin: '6px 0 12px' }}>
              {t('tour.finTexto')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primario btn-mini" onClick={completarTour}>
                {t('comunes.listo')}
              </button>
            </div>
          </>
        ) : (
          <>
            <strong>
              {t('tour.titulo')} · {paso + 1}/{PASOS.length}
            </strong>
            <p className="mini suave" style={{ margin: '6px 0 12px' }}>
              {t(TEXTO[PASOS[paso]!])}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="btn btn-fantasma btn-mini" onClick={completarTour}>
                {t('comunes.omitir')}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                {paso > 0 && (
                  <button className="btn btn-mini" onClick={() => setPaso(paso - 1)}>
                    {t('comunes.atras')}
                  </button>
                )}
                <button className="btn btn-primario btn-mini" onClick={() => setPaso(paso + 1)}>
                  {t('comunes.siguiente')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
