/** Tarjeta de consultoría fiscal en el Dashboard, con descuento por plan. */

import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { obtenerPrecioConsultoria } from '../../engine/consultoria'
import { USD_MXN_DISPLAY, URL_CONSULTORIA } from '../../config/planes'
import { abrirExterno } from '../../lib/externo'
import { Icono } from '../../ui/Icono'
import { formatoMoneda } from '../../ui/formato'

export function TarjetaConsultoria() {
  const { t } = useTranslation()
  const plan = useApp((s) => s.plan)
  const precio = obtenerPrecioConsultoria(plan)

  return (
    <div className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div className="etiqueta" style={{ marginBottom: 4 }}>
          {t('consultoria.titulo')}
        </div>
        <p style={{ margin: 0 }} className="mini suave">
          {t('consultoria.texto')}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div>
          {precio.descuentoPct > 0 && (
            <span className="mini suave" style={{ textDecoration: 'line-through', marginRight: 8 }}>
              ${precio.precioBaseUsd} USD
            </span>
          )}
          <span className="cifra" style={{ fontSize: 18, fontWeight: 600 }}>
            ${precio.precioFinalUsd} USD
          </span>
        </div>
        <div className="mini suave">
          ≈ {formatoMoneda(precio.precioFinalUsd * USD_MXN_DISPLAY, 'MXN', 0)}
          {precio.descuentoPct > 0 && ` · ${t('consultoria.tuDescuento', { pct: precio.descuentoPct })}`}
        </div>
      </div>
      <button className="btn btn-primario" onClick={() => abrirExterno(URL_CONSULTORIA)}>
        <Icono nombre="externo" tam={14} />
        {t('consultoria.agendar')}
      </button>
    </div>
  )
}
