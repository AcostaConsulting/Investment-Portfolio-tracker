import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { useUi } from '../../state/ui'
import { usePortafolio } from '../../state/selectores'
import { Cifra, Porcentaje } from '../../ui/Cifra'
import { Icono } from '../../ui/Icono'
import { Modal } from '../../ui/Modal'
import { formatoCantidad, formatoFecha, formatoMoneda } from '../../ui/formato'
import { hoyIso } from '../../engine/fechas'
import { tieneCapacidad } from '../../licencias/planes'
import type { Posicion } from '../../engine/portafolio'
import { AlertaPrecioModal } from '../analisis/AlertaPrecioModal'

export function Posiciones() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const plan = useApp((s) => s.plan)
  const fijarPrecio = useApp((s) => s.fijarPrecio)
  const abrirDetalle = useUi((s) => s.abrirDetalle)
  const { posiciones, totales } = usePortafolio()
  const base = totales.monedaBase

  const [capturando, setCapturando] = useState<Posicion | undefined>()
  const [precio, setPrecio] = useState('')
  const [monedaPrecio, setMonedaPrecio] = useState('')
  const [alertaPara, setAlertaPara] = useState<Posicion | undefined>()
  const [verCerradas, setVerCerradas] = useState(false)

  const abiertas = posiciones.filter((p) => p.cantidad > 0).sort((a, b) => (b.valorBase ?? 0) - (a.valorBase ?? 0))
  const cerradas = posiciones.filter((p) => p.cantidad === 0)
  const puedeAlertas = tieneCapacidad(plan, 'alertasPrecio')

  function abrirCaptura(p: Posicion) {
    setCapturando(p)
    const actual = doc.precios[p.activo.id]
    setPrecio(actual ? String(actual.precio) : '')
    setMonedaPrecio(actual?.moneda ?? p.activo.moneda)
  }

  function guardarPrecio() {
    if (!capturando || !(Number(precio) > 0)) return
    fijarPrecio(capturando.activo.id, {
      precio: Number(precio),
      moneda: monedaPrecio.trim().toUpperCase() || capturando.activo.moneda,
      actualizado: hoyIso(),
    })
    setCapturando(undefined)
  }

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('posiciones.titulo')}</h1>
      </div>

      <div className="tabla-marco">
        {abiertas.length === 0 ? (
          <div className="vacio">
            <h3>{t('posiciones.sinPosiciones')}</h3>
          </div>
        ) : (
          <table className="libro">
            <thead>
              <tr>
                <th>{t('comunes.activo')}</th>
                <th className="num">{t('comunes.cantidad')}</th>
                <th className="num">{t('posiciones.precioPromedio')}</th>
                <th className="num">{t('posiciones.precioActual')}</th>
                <th className="num">{t('posiciones.valorActual')}</th>
                <th className="num">{t('posiciones.pnl')}</th>
                <th className="num">{t('posiciones.rendimiento')}</th>
                <th className="num">{t('posiciones.peso')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {abiertas.map((p) => {
                const precioActual = doc.precios[p.activo.id]
                const esRF = p.activo.clase === 'renta_fija'
                const peso = totales.valorTotal > 0 ? ((p.valorBase ?? 0) / totales.valorTotal) * 100 : 0
                return (
                  <tr key={p.activo.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="punto"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: `var(--c-${p.activo.clase === 'renta_fija' ? 'renta-fija' : p.activo.clase})`,
                          }}
                        />
                        <button
                          type="button"
                          className="enlace-activo"
                          onClick={() => abrirDetalle(p.activo.id)}
                          title={t('detalle.ver')}
                        >
                          {p.activo.simbolo}
                        </button>
                        <span className="mini suave">{p.activo.nombre}</span>
                        {p.activo.etiquetaIds?.map((id) => {
                          const e = doc.etiquetas.find((x) => x.id === id)
                          return e ? (
                            <span
                              key={id}
                              className="chip"
                              style={{
                                borderColor: 'transparent',
                                background: `color-mix(in srgb, ${e.color} 16%, transparent)`,
                                color: e.color,
                                fontSize: 10.5,
                                padding: '1px 7px',
                              }}
                            >
                              {e.nombre}
                            </span>
                          ) : null
                        })}
                        {p.sinPrecio && !esRF && (
                          <span className="chip ambar" title={t('posiciones.sinPrecioAviso')}>
                            !
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="num cifra">{formatoCantidad(p.cantidad)}</td>
                    <td className="num cifra mini">
                      {p.precioPromedioNativo !== undefined
                        ? formatoMoneda(p.precioPromedioNativo, p.activo.moneda)
                        : p.precioPromedioBase !== undefined
                          ? formatoMoneda(p.precioPromedioBase, base)
                          : '—'}
                    </td>
                    <td className="num cifra mini">
                      {esRF ? (
                        <span className="suave">—</span>
                      ) : precioActual ? (
                        <span title={precioActual.actualizado ? t('posiciones.actualizado', { fecha: formatoFecha(precioActual.actualizado) }) : undefined}>
                          {formatoMoneda(precioActual.precio, precioActual.moneda)}
                        </span>
                      ) : (
                        <span className="suave">—</span>
                      )}
                    </td>
                    <td className="num">
                      <Cifra valor={p.valorBase ?? 0} moneda={base} />
                    </td>
                    <td className="num">
                      <Cifra valor={p.pnlNoRealizadoBase ?? 0} moneda={base} signo />
                    </td>
                    <td className="num">
                      <Porcentaje valor={p.rendimientoPct ?? 0} />
                    </td>
                    <td className="num cifra suave mini">{peso.toFixed(1)}%</td>
                    <td>
                      <div className="fila-acciones">
                        {!esRF && (
                          <button className="btn-icono" onClick={() => abrirCaptura(p)} title={t('posiciones.fijarPrecio')}>
                            <Icono nombre="refrescar" tam={14} />
                          </button>
                        )}
                        {puedeAlertas && !esRF && (
                          <button className="btn-icono" onClick={() => setAlertaPara(p)} title={t('alertasPrecio.nueva')}>
                            <Icono nombre="alerta" tam={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('comunes.valor')}</td>
                <td colSpan={3} />
                <td className="num">
                  <Cifra valor={totales.valorTotal} moneda={base} />
                </td>
                <td className="num">
                  <Cifra valor={totales.pnlNoRealizado} moneda={base} signo />
                </td>
                <td className="num">
                  <Porcentaje valor={totales.rendimientoPct} />
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {cerradas.length > 0 && (
        <div className="tabla-marco">
          <button
            className="btn btn-fantasma"
            style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 0 }}
            onClick={() => setVerCerradas(!verCerradas)}
          >
            <span className="etiqueta">
              {t('posiciones.cerradas')} ({cerradas.length})
            </span>
            <span style={{ transform: verCerradas ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }}>
              <Icono nombre="flecha" tam={14} />
            </span>
          </button>
          {verCerradas && (
            <table className="libro">
              <thead>
                <tr>
                  <th>{t('comunes.activo')}</th>
                  <th className="num">{t('posiciones.realizadoTotal')}</th>
                  <th className="num">{t('resumen.ingresos')}</th>
                </tr>
              </thead>
              <tbody>
                {cerradas.map((p) => (
                  <tr key={p.activo.id}>
                    <td>
                      <button
                        type="button"
                        className="enlace-activo"
                        onClick={() => abrirDetalle(p.activo.id)}
                        title={t('detalle.ver')}
                      >
                        {p.activo.simbolo}
                      </button>{' '}
                      <span className="mini suave">{p.activo.nombre}</span>
                    </td>
                    <td className="num">
                      <Cifra valor={p.realizadoBase} moneda={base} signo />
                    </td>
                    <td className="num">
                      <Cifra valor={p.ingresosBase} moneda={base} signo />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {capturando && (
        <Modal
          titulo={`${t('posiciones.fijarPrecio')} · ${capturando.activo.simbolo}`}
          abierto
          alCerrar={() => setCapturando(undefined)}
          pie={
            <>
              <button className="btn" onClick={() => setCapturando(undefined)}>
                {t('comunes.cancelar')}
              </button>
              <button className="btn btn-primario" onClick={guardarPrecio} disabled={!(Number(precio) > 0)}>
                {t('comunes.guardar')}
              </button>
            </>
          }
        >
          <div className="form-rejilla">
            <div className="campo">
              <label>{t('posiciones.precioActual')}</label>
              <input type="number" step="any" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus />
            </div>
            <div className="campo">
              <label>{t('comunes.moneda')}</label>
              <input value={monedaPrecio} onChange={(e) => setMonedaPrecio(e.target.value.toUpperCase())} maxLength={5} />
            </div>
          </div>
        </Modal>
      )}

      {alertaPara && <AlertaPrecioModal posicion={alertaPara} alCerrar={() => setAlertaPara(undefined)} />}
    </div>
  )
}
