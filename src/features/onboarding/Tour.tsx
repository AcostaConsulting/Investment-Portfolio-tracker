import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'

const PASOS = ['resumen', 'posiciones', 'movimientos', 'rentafija', 'configuracion'] as const

const TEXTO: Record<(typeof PASOS)[number], 'tour.resumen' | 'tour.posiciones' | 'tour.movimientos' | 'tour.rentaFija' | 'tour.configuracion'> = {
  resumen: 'tour.resumen',
  posiciones: 'tour.posiciones',
  movimientos: 'tour.movimientos',
  rentafija: 'tour.rentaFija',
  configuracion: 'tour.configuracion',
}

export function Tour() {
  const { t } = useTranslation()
  const completarTour = useApp((s) => s.completarTour)
  const [paso, setPaso] = useState(0)
  const terminado = paso >= PASOS.length

  // Resalta el elemento del nav correspondiente al paso actual.
  useEffect(() => {
    if (terminado) return
    const el = document.querySelector(`[data-tour="${PASOS[paso]}"]`)
    el?.classList.add('tour-destacado')
    return () => el?.classList.remove('tour-destacado')
  }, [paso, terminado])

  return (
    <div className="tour-tarjeta tarjeta">
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
  )
}
