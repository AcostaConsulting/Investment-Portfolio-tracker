import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { IDIOMAS } from '../../i18n'
import type { Idioma } from '../../state/documento'
import { Icono } from '../../ui/Icono'

const MONEDAS = ['MXN', 'USD', 'EUR']

export function Onboarding() {
  const { t } = useTranslation()
  const actualizarAjustes = useApp((s) => s.actualizarAjustes)
  const completarOnboarding = useApp((s) => s.completarOnboarding)
  const ajustes = useApp((s) => s.doc.ajustes)
  const [paso, setPaso] = useState(0)

  const pasos = [
    { titulo: t('onboarding.titulo1'), texto: t('onboarding.texto1'), icono: 'candado' as const },
    { titulo: t('onboarding.titulo2'), texto: t('onboarding.texto2'), icono: 'resumen' as const },
    { titulo: t('onboarding.titulo3'), texto: t('onboarding.texto3'), icono: 'rentaFija' as const },
  ]

  const esUltimo = paso === pasos.length

  return (
    <div className="onboarding">
      <div className="onboarding-tarjeta">
        <div className="lateral-marca" style={{ padding: 0, marginBottom: 4 }}>
          Tracker de <em>Portafolio</em>
        </div>

        {!esUltimo ? (
          <>
            <span style={{ color: 'var(--acento)', margin: '18px 0 6px' }}>
              <Icono nombre={pasos[paso]!.icono} tam={34} />
            </span>
            <h2>{pasos[paso]!.titulo}</h2>
            <p className="suave">{pasos[paso]!.texto}</p>
          </>
        ) : (
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

        <div className="onboarding-puntos">
          {[...pasos, null].map((_, i) => (
            <span key={i} className={i === paso ? 'activo' : ''} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
          <button className="btn btn-fantasma" onClick={() => (paso > 0 ? setPaso(paso - 1) : completarOnboarding())}>
            {paso > 0 ? t('comunes.atras') : t('comunes.omitir')}
          </button>
          {esUltimo ? (
            <button className="btn btn-primario" onClick={completarOnboarding}>
              {t('onboarding.empezar')}
            </button>
          ) : (
            <button className="btn btn-primario" onClick={() => setPaso(paso + 1)}>
              {t('comunes.siguiente')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
