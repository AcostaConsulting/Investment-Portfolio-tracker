import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { formatoFecha } from '../../ui/formato'
import { PRECIOS_USD } from '../../licencias/planes'

const URL_GUMROAD = 'https://gumroad.com'

export function SeccionLicencia() {
  const { t } = useTranslation()
  const plan = useApp((s) => s.plan)
  const estado = useApp((s) => s.licenciaEstado)
  const activarLicencia = useApp((s) => s.activarLicencia)
  const quitarLicencia = useApp((s) => s.quitarLicencia)
  const [cadena, setCadena] = useState('')
  const [mensaje, setMensaje] = useState<'' | 'ok' | 'vencida' | 'invalida'>('')

  const nombrePlan = t(
    plan === 'free'
      ? 'licencia.planFree'
      : plan === 'pro'
        ? 'licencia.planPro'
        : plan === 'premium'
          ? 'licencia.planPremium'
          : 'licencia.planLifetime',
  )

  async function activar() {
    const resultado = await activarLicencia(cadena)
    if (resultado.estado === 'valida') {
      setMensaje('ok')
      setCadena('')
    } else if (resultado.estado === 'vencida') {
      setMensaje('vencida')
    } else {
      setMensaje('invalida')
    }
  }

  function quitar() {
    if (window.confirm(t('licencia.quitarConfirma'))) {
      quitarLicencia()
      setMensaje('')
    }
  }

  return (
    <div className="tarjeta" data-tour="licencia">
      <div className="etiqueta" style={{ marginBottom: 12 }}>
        {t('licencia.titulo')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className={`sello-plan ${plan === 'free' ? '' : 'pago'}`}>{nombrePlan}</span>
        {estado?.estado === 'valida' && (
          <span className="mini positivo">
            {t('licencia.estadoValida')}
            {estado.vence && ` · ${t('licencia.vence', { fecha: formatoFecha(estado.vence) })}`}
          </span>
        )}
      </div>

      {estado?.estado === 'vencida' && (
        <p className="mini" style={{ color: 'var(--ambar)' }}>
          {t('licencia.estadoVencida', { fecha: formatoFecha(estado.vencio) })}
        </p>
      )}

      {plan === 'free' ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <textarea
              placeholder={t('licencia.pegaAqui')}
              value={cadena}
              onChange={(e) => setCadena(e.target.value)}
              rows={3}
              style={{ flex: 1, minWidth: 280, fontFamily: 'var(--f-mono)', fontSize: 11.5 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primario" onClick={() => void activar()} disabled={!cadena.trim()}>
                {t('licencia.activar')}
              </button>
              <a className="btn" href={URL_GUMROAD} target="_blank" rel="noreferrer">
                {t('licencia.comprar')}
              </a>
            </div>
          </div>
          {mensaje === 'invalida' && (
            <p className="mini" style={{ color: 'var(--rojo)' }}>
              {t('licencia.estadoInvalida')}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(Object.entries(PRECIOS_USD) as [keyof typeof PRECIOS_USD, (typeof PRECIOS_USD)[keyof typeof PRECIOS_USD]][]).map(
              ([clave, precio]) => (
                <span key={clave} className="chip">
                  {t(clave === 'pro' ? 'licencia.planPro' : clave === 'premium' ? 'licencia.planPremium' : 'licencia.planLifetime')}{' '}
                  · ${precio.monto} USD{precio.tipo === 'mensual' ? '/mes' : ''}
                </span>
              ),
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mensaje === 'ok' && <span className="mini positivo">{t('licencia.activada', { plan: nombrePlan })}</span>}
          <button className="btn btn-peligro" onClick={quitar}>
            {t('licencia.quitar')}
          </button>
        </div>
      )}
    </div>
  )
}
