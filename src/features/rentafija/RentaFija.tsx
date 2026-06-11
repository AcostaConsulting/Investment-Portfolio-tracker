import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { useAlertasVencimiento, usePortafolio } from '../../state/selectores'
import { Cifra } from '../../ui/Cifra'
import { Icono } from '../../ui/Icono'
import { FormActivo } from '../captura/FormActivo'
import { FormOperacion } from '../captura/FormOperacion'
import { formatoFecha, formatoMoneda, formatoPct } from '../../ui/formato'

export function RentaFija() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const { posiciones } = usePortafolio()
  const vencimientos = useAlertasVencimiento()
  const [creando, setCreando] = useState(false)
  const [capturandoPara, setCapturandoPara] = useState<string | undefined>()

  const posicionesRF = posiciones.filter((p) => p.activo.clase === 'renta_fija' && p.cantidad > 0)
  const vencidas = new Set(vencimientos.filter((v) => v.vencido).map((v) => v.activoId))

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('rentaFija.titulo')}</h1>
        <div className="vista-acciones">
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            <Icono nombre="mas" tam={14} />
            {t('rentaFija.nuevoInstrumento')}
          </button>
        </div>
      </div>

      {vencimientos.length > 0 && (
        <div className="tarjeta" style={{ padding: '12px 16px' }}>
          <div className="etiqueta" style={{ marginBottom: 8 }}>
            {t('rentaFija.alertas')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {vencimientos.map((v) => (
              <span key={v.activoId} className={`chip ${v.vencido ? 'rojo' : v.diasRestantes <= 7 ? 'ambar' : ''}`}>
                {v.simbolo} ·{' '}
                {v.vencido
                  ? t('resumen.vencido')
                  : v.diasRestantes === 0
                    ? t('resumen.venceHoy')
                    : t('resumen.venceEn', { dias: v.diasRestantes })}
              </span>
            ))}
          </div>
        </div>
      )}

      {posicionesRF.length === 0 ? (
        <div className="tarjeta vacio">
          <h3>{t('rentaFija.vacioTitulo')}</h3>
          <p>{t('rentaFija.vacioTexto')}</p>
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            <Icono nombre="mas" tam={14} />
            {t('rentaFija.nuevoInstrumento')}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {posicionesRF.map((p) => {
              const detalle = p.activo.rentaFija!
              const v = p.rentaFija
              const progreso =
                v?.diasPlazo && v.diasPlazo > 0 ? Math.min(100, (v.diasTranscurridos / v.diasPlazo) * 100) : undefined
              return (
                <div className="tarjeta" key={p.activo.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.activo.simbolo}</span>
                    <span className="chip acento">{t(`rentaFija.instrumentos.${detalle.instrumento}`)}</span>
                    <span className="chip">{formatoPct(detalle.tasaAnual)}</span>
                    {vencidas.has(p.activo.id) && <span className="chip rojo">{t('rentaFija.vencido')}</span>}
                    <button
                      className="btn btn-fantasma btn-mini"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => setCapturandoPara(p.activo.id)}
                      title={t('movimientos.nuevo')}
                    >
                      <Icono nombre="mas" tam={13} />
                    </button>
                  </div>
                  <div className="mini suave">{p.activo.nombre}</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div>
                      <div className="etiqueta">{t('rentaFija.invertido')}</div>
                      <Cifra valor={p.costoNativo ?? p.costoBase} moneda={p.activo.moneda} />
                    </div>
                    <div>
                      <div className="etiqueta">{t('rentaFija.valorHoy')}</div>
                      <Cifra valor={p.valorNativo ?? p.valorBase ?? 0} moneda={p.activo.moneda} />
                    </div>
                    <div>
                      <div className="etiqueta">{t('rentaFija.devengado')}</div>
                      <span className="cifra positivo">
                        +{formatoMoneda(v?.interesBrutoDevengado ?? 0, p.activo.moneda)}
                      </span>
                    </div>
                    <div>
                      <div className="etiqueta">{t('rentaFija.isrEstimado')}</div>
                      <span className="cifra negativo">
                        −{formatoMoneda(v?.isrEstimadoDevengado ?? 0, p.activo.moneda)}
                      </span>
                    </div>
                    {v?.netoAlVencimiento !== undefined && (
                      <div>
                        <div className="etiqueta">{t('rentaFija.netoAlVencimiento')}</div>
                        <Cifra valor={v.netoAlVencimiento} moneda={p.activo.moneda} />
                      </div>
                    )}
                    {detalle.fechaVencimiento && (
                      <div>
                        <div className="etiqueta">{t('rentaFija.fechaVencimiento')}</div>
                        <span className="cifra mini">{formatoFecha(detalle.fechaVencimiento)}</span>
                        {v?.diasRestantes !== undefined && v.diasRestantes > 0 && (
                          <span className="mini suave">
                            {' '}
                            · {t('rentaFija.diasRestantes')} {v.diasRestantes} {t('comunes.dias')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {progreso !== undefined && (
                    <div>
                      <div className="barra-h">
                        <div style={{ width: `${progreso}%` }} />
                      </div>
                      <div className="mini suave" style={{ marginTop: 4 }}>
                        {t('rentaFija.progreso')}: {progreso.toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mini suave">{t('rentaFija.notaIsr', { tasa: doc.ajustes.tasaIsrAnual })}</p>
        </>
      )}

      {creando && (
        <FormActivo
          abierto
          alCerrar={() => setCreando(false)}
          claseInicial="renta_fija"
          alGuardar={(a) => setCapturandoPara(a.id)}
        />
      )}
      {capturandoPara && (
        <FormOperacion abierto alCerrar={() => setCapturandoPara(undefined)} activoSugerido={capturandoPara} />
      )}
    </div>
  )
}
