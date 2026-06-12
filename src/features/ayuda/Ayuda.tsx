/** Ayuda: inicio rápido, videos (placeholder), FAQ y reporte de problemas. */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icono } from '../../ui/Icono'
import { abrirExterno } from '../../lib/externo'
import { URL_CONTACTO } from '../../config/planes'

const PASOS_INICIO = ['paso1', 'paso2', 'paso3', 'paso4'] as const
const VIDEOS = ['video1', 'video2', 'video3', 'video4', 'video5'] as const
const FAQS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export function Ayuda() {
  const { t } = useTranslation()
  const [mensaje, setMensaje] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api?.sistema.info().then((i) => setVersion(i.version))
  }, [])

  async function copiarReporte() {
    const reporte = `Tracker de Portafolio v${version || '?'} — ${navigator.platform}\n\n${mensaje}`
    await navigator.clipboard.writeText(reporte)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('nav.ayuda')}</h1>
      </div>

      {/* ---------- Inicio rápido ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('ayuda.inicioRapido')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {PASOS_INICIO.map((paso, i) => (
            <div key={paso} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                className="cifra"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span className="mini">{t(`ayuda.${paso}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Videos ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('ayuda.videos')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {VIDEOS.map((video) => (
            <div key={video} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  aspectRatio: '16/9',
                  borderRadius: 'var(--radio)',
                  background: 'linear-gradient(135deg, var(--accent-subtle), var(--surface-2))',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Icono nombre="flecha" tam={26} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="mini" style={{ fontWeight: 600 }}>
                  {t(`ayuda.${video}`)}
                </span>
                <span className="chip ambar" style={{ fontSize: 10 }}>
                  {t('ayuda.proximamente')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- FAQ ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 8 }}>
          {t('ayuda.faq')}
        </div>
        {FAQS.map((n) => (
          <details key={n} className="faq-item">
            <summary>{t(`ayuda.faq${n}q`)}</summary>
            <p className="mini suave">{t(`ayuda.faq${n}r`)}</p>
          </details>
        ))}
      </div>

      {/* ---------- Reportar problema ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 8 }}>
          {t('ayuda.reportar')}
        </div>
        <p className="mini suave" style={{ margin: '0 0 10px' }}>
          {t('ayuda.reportarAyuda')}
        </p>
        <textarea
          rows={4}
          style={{ width: '100%', resize: 'vertical' }}
          placeholder={t('ayuda.reportarPlaceholder')}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button className="btn btn-primario" onClick={() => void copiarReporte()} disabled={!mensaje.trim()}>
            <Icono nombre="copiar" tam={14} />
            {t('ayuda.copiarReporte')}
          </button>
          <button className="btn" onClick={() => abrirExterno(URL_CONTACTO)}>
            <Icono nombre="externo" tam={14} />
            {t('ayuda.contactar')}
          </button>
          {copiado && <span className="mini positivo">{t('ayuda.copiado')}</span>}
        </div>
      </div>
    </div>
  )
}
