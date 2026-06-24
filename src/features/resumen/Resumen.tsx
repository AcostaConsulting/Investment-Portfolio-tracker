import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { useUi } from '../../state/ui'
import {
  useAlertasDisparadas,
  useAlertasVencimiento,
  useDiversificacion,
  usePortafolio,
} from '../../state/selectores'
import { TarjetaConsultoria } from './TarjetaConsultoria'
import { Cifra, Porcentaje } from '../../ui/Cifra'
import { Icono } from '../../ui/Icono'
import { DIMENSIONES, GraficaDiversificacion, type Dimension } from '../../ui/GraficaDiversificacion'
import { GraficaEvolucion } from '../../ui/GraficaEvolucion'
import { formatoMoneda, formatoPct } from '../../ui/formato'
import type { Vista } from '../../App'
import type { ClaseActivo } from '../../engine/tipos'

const COLOR_CLASE: Record<ClaseActivo, string> = {
  accion: 'var(--c-accion)',
  cripto: 'var(--c-cripto)',
  renta_fija: 'var(--c-renta-fija)',
}

export function Resumen({ irA }: { irA: (vista: Vista) => void }) {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const abrirDetalle = useUi((s) => s.abrirDetalle)
  const { posiciones, totales, advertencias } = usePortafolio()
  const diversificacion = useDiversificacion()
  const vencimientos = useAlertasVencimiento()
  const alertasDisparadas = useAlertasDisparadas()
  const base = totales.monedaBase
  const [dimension, setDimension] = useState<Dimension>('clase')

  if (doc.operaciones.length === 0) {
    return (
      <div className="vista">
        <div className="vista-cabecera">
          <h1>{t('nav.resumen')}</h1>
        </div>
        <div className="tarjeta vacio">
          <h3>{t('resumen.vacioTitulo')}</h3>
          <p>{t('resumen.vacioTexto')}</p>
          <button className="btn btn-primario" onClick={() => irA('movimientos')}>
            <Icono nombre="mas" />
            {t('resumen.vacioBoton')}
          </button>
        </div>
      </div>
    )
  }

  const sinPrecio = advertencias.filter((a) => a.codigo === 'sin_precio').length
  const sinTc = advertencias.some((a) => a.codigo === 'sin_tipo_cambio')
  const abiertas = posiciones.filter((p) => p.cantidad > 0)
  const topActivos = [...abiertas]
    .sort((a, b) => (b.valorBase ?? 0) - (a.valorBase ?? 0))
    .slice(0, 8)

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('nav.resumen')}</h1>
        {alertasDisparadas.length > 0 && (
          <button className="chip ambar" style={{ cursor: 'pointer', border: 'none' }} onClick={() => irA('analisis')}>
            <Icono nombre="alerta" tam={13} />
            {t('alertasPrecio.badge', { count: alertasDisparadas.length })}
          </button>
        )}
      </div>

      {(sinPrecio > 0 || sinTc) && (
        <div className="tarjeta" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px' }}>
          <span style={{ color: 'var(--warning)' }}>
            <Icono nombre="advertencia" />
          </span>
          <span className="mini suave">
            {sinPrecio > 0 && t('resumen.sinPrecio', { count: sinPrecio })}
            {sinPrecio > 0 && sinTc && ' · '}
            {sinTc && t('resumen.sinTipoCambio')}
          </span>
        </div>
      )}

      <div className="kpis">
        <div className="tarjeta kpi-hero">
          <div>
            <div className="etiqueta">{t('resumen.valorTotal')}</div>
            <div className="monto">{formatoMoneda(totales.valorTotal, base)}</div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
            <div className="kpi">
              <span className="etiqueta">{t('resumen.rendimiento')}</span>
              <span className="monto">
                <Porcentaje valor={totales.rendimientoPct} />
              </span>
            </div>
            <div className="kpi">
              <span className="etiqueta">{t('resumen.gananciaTotal')}</span>
              <span className="monto">
                <Cifra valor={totales.gananciaTotal} moneda={base} signo />
              </span>
            </div>
          </div>
        </div>

        <div className="tarjeta kpi">
          <span className="etiqueta">{t('resumen.costoTotal')}</span>
          <span className="monto">
            <Cifra valor={totales.costoTotal} moneda={base} />
          </span>
        </div>
        <div className="tarjeta kpi">
          <span className="etiqueta">{t('resumen.pnlNoRealizado')}</span>
          <span className="monto">
            <Cifra valor={totales.pnlNoRealizado} moneda={base} signo />
          </span>
        </div>
        <div className="tarjeta kpi">
          <span className="etiqueta">{t('resumen.pnlRealizado')}</span>
          <span className="monto">
            <Cifra valor={totales.pnlRealizado} moneda={base} signo />
          </span>
        </div>
        <div className="tarjeta kpi">
          <span className="etiqueta">{t('resumen.ingresos')}</span>
          <span className="monto">
            <Cifra valor={totales.ingresos} moneda={base} signo />
          </span>
        </div>
      </div>

      <GraficaEvolucion historico={doc.historico} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        <div className="tarjeta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="etiqueta" style={{ marginRight: 'auto' }}>
              {t('resumen.distribucion')}
            </span>
            {DIMENSIONES.map((d) => (
              <button
                key={d}
                className={`btn btn-mini ${dimension === d ? 'btn-primario' : 'btn-fantasma'}`}
                onClick={() => setDimension(d)}
              >
                {t(
                  d === 'clase'
                    ? 'comunes.clase'
                    : d === 'sector'
                      ? 'clasificacion.sector'
                      : d === 'geografia'
                        ? 'clasificacion.geografia'
                        : 'clasificacion.etiquetas',
                )}
              </button>
            ))}
          </div>
          <GraficaDiversificacion vista={diversificacion} dimension={dimension} tam={150} />
        </div>

        <div className="tarjeta">
          <div className="etiqueta" style={{ marginBottom: 12 }}>
            {t('resumen.distribucion')} · {t('resumen.porActivo')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topActivos.map((p) => {
              const pct = totales.valorTotal > 0 ? ((p.valorBase ?? 0) / totales.valorTotal) * 100 : 0
              return (
                <div key={p.activo.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <button
                      type="button"
                      className="enlace-activo"
                      style={{ fontSize: 12 }}
                      onClick={() => abrirDetalle(p.activo.id)}
                      title={t('detalle.ver')}
                    >
                      {p.activo.simbolo}
                    </button>
                    <span className="mini cifra suave">
                      {formatoMoneda(p.valorBase ?? 0, base)} · {formatoPct(pct)}
                    </span>
                  </div>
                  <div className="barra-h">
                    <div style={{ width: `${pct}%`, background: COLOR_CLASE[p.activo.clase] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 10 }}>
          {t('resumen.vencimientos')}
        </div>
        {vencimientos.length === 0 ? (
          <span className="mini suave">{t('resumen.sinVencimientos')}</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vencimientos.map((v) => (
              <div key={v.activoId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`chip ${v.vencido ? 'rojo' : v.diasRestantes <= 7 ? 'ambar' : ''}`}>
                  {v.vencido
                    ? t('resumen.vencido')
                    : v.diasRestantes === 0
                      ? t('resumen.venceHoy')
                      : t('resumen.venceEn', { dias: v.diasRestantes })}
                </span>
                <span style={{ fontWeight: 600 }}>{v.simbolo}</span>
                <span className="mini suave">{v.nombre}</span>
                <button className="btn btn-fantasma btn-mini" style={{ marginLeft: 'auto' }} onClick={() => irA('rentafija')}>
                  <Icono nombre="flecha" tam={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <TarjetaConsultoria />
    </div>
  )
}
