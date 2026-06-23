/**
 * Evolución del valor total del portafolio en el tiempo. Gráfica de línea SVG
 * sin dependencias (mismo enfoque que la Dona): se alimenta de los snapshots
 * diarios `{fecha, valor}` que la app guarda cuando ya actualizó precios.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../state/store'
import { formatoFecha, formatoMoneda } from './formato'
import { Cifra, Porcentaje } from './Cifra'
import type { PuntoHistorico } from '../state/documento'

const ANCHO = 720
const ALTO = 200
const PAD_X = 6
const PAD_TOP = 12
const PAD_BOTTOM = 12

export function GraficaEvolucion({ historico }: { historico: PuntoHistorico[] }) {
  const { t } = useTranslation()
  const base = useApp((s) => s.doc.ajustes.monedaBase)
  const idGrad = useId()

  // Con 0 o 1 puntos no hay nada que dibujar: estado vacío elegante.
  if (historico.length < 2) {
    return (
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 8 }}>
          {t('resumen.evolucion')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0' }}>
          <strong className="mini">{t('resumen.evolucionVacio')}</strong>
          <span className="mini suave">{t('resumen.evolucionVacioAyuda')}</span>
        </div>
      </div>
    )
  }

  const primero = historico[0]!
  const ultimo = historico[historico.length - 1]!
  const valores = historico.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  const n = historico.length

  const x = (i: number) => PAD_X + (i / (n - 1)) * (ANCHO - 2 * PAD_X)
  const y = (v: number) => PAD_TOP + (1 - (v - min) / rango) * (ALTO - PAD_TOP - PAD_BOTTOM)

  const puntos = historico.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`)
  const linea = `M ${puntos.join(' L ')}`
  const area = `M ${x(0).toFixed(1)},${ALTO} L ${puntos.join(' L ')} L ${x(n - 1).toFixed(1)},${ALTO} Z`

  const cambio = ultimo.valor - primero.valor
  const cambioPct = primero.valor !== 0 ? (cambio / primero.valor) * 100 : 0
  const color = cambio >= 0 ? 'var(--gain)' : 'var(--loss)'

  return (
    <div className="tarjeta">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <span className="etiqueta" style={{ marginRight: 'auto' }}>
          {t('resumen.evolucion')}
        </span>
        <span className="monto" style={{ fontSize: 22 }}>
          {formatoMoneda(ultimo.valor, base)}
        </span>
        <span className="mini">
          <Cifra valor={cambio} moneda={base} signo /> (<Porcentaje valor={cambioPct} />)
        </span>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        height={ALTO}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('resumen.evolucion')}
      >
        <defs>
          <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${idGrad})`} />
        <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(ultimo.valor)} r="3.5" fill={color} />
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="mini suave">{formatoFecha(primero.fecha)}</span>
        <span className="mini suave">{formatoFecha(ultimo.fecha)}</span>
      </div>
    </div>
  )
}
