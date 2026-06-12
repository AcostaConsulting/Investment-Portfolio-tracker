/** Wizard de primera apertura: bienvenida → configuración → punto de partida. */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { IDIOMAS } from '../../i18n'
import type { Idioma } from '../../state/documento'
import { Icono } from '../../ui/Icono'

const MONEDAS = ['MXN', 'USD']

export function Onboarding() {
  const { t } = useTranslation()
  const actualizarAjustes = useApp((s) => s.actualizarAjustes)
  const completarOnboarding = useApp((s) => s.completarOnboarding)
  const cargarDatosEjemplo = useApp((s) => s.cargarDatosEjemplo)
  const ajustes = useApp((s) => s.doc.ajustes)
  const [paso, setPaso] = useState(0)

  function empezar(conEjemplo: boolean) {
    if (conEjemplo) cargarDatosEjemplo()
    completarOnboarding()
  }

  return (
    <div className="onboarding">
      <div className="onboarding-tarjeta">
        <div className="lateral-marca" style={{ padding: 0, marginBottom: 4 }}>
          Tracker de <em>Portafolio</em>
        </div>

        {paso === 0 && (
          <>
            <span style={{ color: 'var(--accent)', margin: '18px 0 6px' }}>
              <Icono nombre="resumen" tam={34} />
            </span>
            <h2>{t('onboarding.titulo1')}</h2>
            <p className="suave">{t('onboarding.texto1')}</p>
          </>
        )}

        {paso === 1 && (
          <>
            <h2 style={{ marginTop: 18 }}>{t('onboarding.bienvenida')}</h2>
            <div className="form-rejilla" style={{ width: '100%', marginTop: 10 }}>
              <div className="campo">
                <label>{t('onboarding.idiomaPregunta')}</label>
                <select value={ajustes.idioma} onChange={(e) => actualizarAjustes({ idioma: e.target.value as Idioma })}>
                  {IDIOMAS.map((i) => (
                    <option key={i.codigo} value={i.codigo}>
                      {i.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label>{t('onboarding.monedaPregunta')}</label>
                <select value={ajustes.monedaBase} onChange={(e) => actualizarAjustes({ monedaBase: e.target.value })}>
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <h2 style={{ marginTop: 18 }}>{t('onboarding.comoEmpezar')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 10 }}>
              <button className="btn btn-primario" style={{ justifyContent: 'center' }} onClick={() => empezar(true)}>
                {t('onboarding.cargarEjemplo')}
              </button>
              <span className="mini suave">{t('onboarding.ejemploAyuda')}</span>
              <button className="btn" style={{ justifyContent: 'center' }} onClick={() => empezar(false)}>
                {t('onboarding.empezarBlanco')}
              </button>
            </div>
          </>
        )}

        <div className="onboarding-puntos">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i === paso ? 'activo' : ''} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
          <button
            className="btn btn-fantasma"
            onClick={() => (paso > 0 ? setPaso(paso - 1) : completarOnboarding())}
          >
            {paso > 0 ? t('comunes.atras') : t('comunes.omitir')}
          </button>
          {paso < 2 && (
            <button className="btn btn-primario" onClick={() => setPaso(paso + 1)}>
              {t('comunes.siguiente')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
