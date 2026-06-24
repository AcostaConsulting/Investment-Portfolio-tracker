import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { useUi } from '../../state/ui'
import { usePortafolio } from '../../state/selectores'
import { FormActivo } from '../captura/FormActivo'
import { FormOperacion } from '../captura/FormOperacion'
import { Cifra, Porcentaje } from '../../ui/Cifra'
import { Icono } from '../../ui/Icono'
import { formatoCantidad, formatoFecha, formatoMoneda } from '../../ui/formato'
import { compararPorFecha } from '../../engine/fechas'
import { SECTORES_ACCION, type Operacion, type TipoOperacion } from '../../engine/tipos'

const CHIP_TIPO: Record<TipoOperacion, string> = {
  compra: 'verde',
  venta: 'rojo',
  dividendo: 'acento',
  interes: 'acento',
  staking: 'acento',
  ajuste: '',
  airdrop: 'ambar',
  recompensa: 'ambar',
}

export function DetalleActivo() {
  const { t } = useTranslation()
  const activoId = useUi((s) => s.activoDetalle)
  const cerrarDetalle = useUi((s) => s.cerrarDetalle)
  const doc = useApp((s) => s.doc)
  const eliminarOperacion = useApp((s) => s.eliminarOperacion)
  const { posiciones, totales } = usePortafolio()
  const base = totales.monedaBase

  const activo = doc.activos.find((a) => a.id === activoId)
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [editandoOp, setEditandoOp] = useState<Operacion | 'nueva' | undefined>()

  // Si el activo desapareció (p. ej. restauración de respaldo), cierra el detalle.
  useEffect(() => {
    if (activoId && !activo) cerrarDetalle()
  }, [activoId, activo, cerrarDetalle])

  const operaciones = useMemo(
    () =>
      doc.operaciones.filter((o) => o.activoId === activoId).sort((a, b) => -compararPorFecha(a, b)),
    [doc.operaciones, activoId],
  )

  if (!activo) return null

  const posicion = posiciones.find((p) => p.activo.id === activo.id)
  const esRF = activo.clase === 'renta_fija'
  const abierta = !!posicion && posicion.cantidad > 0

  const sectorTexto = activo.sector
    ? activo.clase === 'accion'
      ? t(`clasificacion.sectores.${activo.sector as (typeof SECTORES_ACCION)[number]}`)
      : activo.sector
    : t('clasificacion.sinSector')

  const etiquetas = (activo.etiquetaIds ?? [])
    .map((id) => doc.etiquetas.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e)

  function confirmaEliminar(id: string) {
    if (window.confirm(t('movimientos.confirmaEliminar'))) eliminarOperacion(id)
  }

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-fantasma" onClick={cerrarDetalle}>
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <Icono nombre="flecha" tam={14} />
            </span>
            {t('comunes.atras')}
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="punto"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: `var(--c-${esRF ? 'renta-fija' : activo.clase})`,
              }}
            />
            {activo.simbolo}
            <span className="mini suave" style={{ fontWeight: 400 }}>
              {activo.nombre}
            </span>
          </h1>
        </div>
        <div className="vista-acciones">
          <button className="btn" onClick={() => setEditandoMeta(true)}>
            <Icono nombre="lapiz" tam={14} />
            {t('formActivo.editarTitulo')}
          </button>
        </div>
      </div>

      {/* Resumen de la posición */}
      {posicion && (
        <div className="kpis">
          {abierta ? (
            <>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('comunes.cantidad')}</span>
                <span className="monto cifra">{formatoCantidad(posicion.cantidad)}</span>
              </div>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('posiciones.precioPromedio')}</span>
                <span className="monto cifra">
                  {posicion.precioPromedioNativo !== undefined
                    ? formatoMoneda(posicion.precioPromedioNativo, activo.moneda)
                    : posicion.precioPromedioBase !== undefined
                      ? formatoMoneda(posicion.precioPromedioBase, base)
                      : '—'}
                </span>
              </div>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('posiciones.valorActual')}</span>
                <span className="monto">
                  <Cifra valor={posicion.valorBase ?? 0} moneda={base} />
                </span>
              </div>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('posiciones.pnl')}</span>
                <span className="monto">
                  <Cifra valor={posicion.pnlNoRealizadoBase ?? 0} moneda={base} signo />
                </span>
              </div>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('posiciones.rendimiento')}</span>
                <span className="monto">
                  <Porcentaje valor={posicion.rendimientoPct ?? 0} />
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('posiciones.realizadoTotal')}</span>
                <span className="monto">
                  <Cifra valor={posicion.realizadoBase} moneda={base} signo />
                </span>
              </div>
              <div className="tarjeta kpi">
                <span className="etiqueta">{t('resumen.ingresos')}</span>
                <span className="monto">
                  <Cifra valor={posicion.ingresosBase} moneda={base} signo />
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Información del activo (metadatos) */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('detalle.informacion')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Fila etiqueta={t('comunes.simbolo')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>{activo.simbolo}</span>
              <span className="suave" title={t('formActivo.simboloFijo')}>
                <Icono nombre="candado" tam={13} />
              </span>
            </span>
          </Fila>
          <Fila etiqueta={t('comunes.nombre')}>{activo.nombre}</Fila>
          <Fila etiqueta={t('comunes.clase')}>{t(`clases.${activo.clase}`)}</Fila>
          <Fila etiqueta={t('comunes.moneda')}>{activo.moneda}</Fila>
          {!esRF && <Fila etiqueta={t('clasificacion.sector')}>{sectorTexto}</Fila>}
          <Fila etiqueta={t('clasificacion.geografia')}>
            {activo.geografia ? t(`clasificacion.geografias.${activo.geografia}`) : '—'}
          </Fila>
          <Fila etiqueta={t('clasificacion.etiquetas')}>
            {etiquetas.length === 0 ? (
              '—'
            ) : (
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                {etiquetas.map((e) => (
                  <span
                    key={e.id}
                    className="chip"
                    style={{
                      borderColor: 'transparent',
                      background: `color-mix(in srgb, ${e.color} 16%, transparent)`,
                      color: e.color,
                    }}
                  >
                    {e.nombre}
                  </span>
                ))}
              </span>
            )}
          </Fila>
          <Fila etiqueta={t('clasificacion.liquido')}>
            {activo.liquido === false ? t('analisis.iliquido') : t('analisis.liquido')}
          </Fila>
        </div>
      </div>

      {/* Transacciones */}
      <div className="vista-cabecera" style={{ marginTop: 4 }}>
        <h2 style={{ fontSize: 16 }}>{t('detalle.transacciones')}</h2>
        <div className="vista-acciones">
          <button className="btn btn-primario" onClick={() => setEditandoOp('nueva')}>
            <Icono nombre="mas" tam={14} />
            {t('movimientos.nuevo')}
          </button>
        </div>
      </div>

      <div className="tabla-marco">
        {operaciones.length === 0 ? (
          <div className="vacio">
            <h3>{t('detalle.sinOperaciones')}</h3>
            <button className="btn btn-primario" onClick={() => setEditandoOp('nueva')}>
              <Icono nombre="mas" tam={14} />
              {t('movimientos.nuevo')}
            </button>
          </div>
        ) : (
          <table className="libro">
            <thead>
              <tr>
                <th>{t('comunes.fecha')}</th>
                <th>{t('comunes.tipo')}</th>
                <th className="num">{t('comunes.cantidad')}</th>
                <th className="num">{t('comunes.precio')}</th>
                <th className="num">{t('movimientos.importeBase', { moneda: base })}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {operaciones.map((op) => {
                const importe = op.cantidad * op.precioUnitario * op.tipoCambio
                return (
                  <tr key={op.id}>
                    <td className="cifra mini">{formatoFecha(op.fecha)}</td>
                    <td>
                      <span className={`chip ${CHIP_TIPO[op.tipo]}`}>{t(`operaciones.${op.tipo}`)}</span>
                      {op.nota && (
                        <span className="mini suave" style={{ marginLeft: 8 }}>
                          {op.nota}
                        </span>
                      )}
                    </td>
                    <td className="num cifra">{formatoCantidad(op.cantidad)}</td>
                    <td className="num cifra">{formatoMoneda(op.precioUnitario, op.moneda)}</td>
                    <td className="num">
                      <Cifra valor={importe} moneda={base} />
                    </td>
                    <td>
                      <div className="fila-acciones">
                        <button className="btn-icono" onClick={() => setEditandoOp(op)} title={t('comunes.editar')}>
                          <Icono nombre="lapiz" tam={14} />
                        </button>
                        <button
                          className="btn-icono peligro"
                          onClick={() => confirmaEliminar(op.id)}
                          title={t('comunes.eliminar')}
                        >
                          <Icono nombre="basura" tam={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editandoMeta && (
        <FormActivo abierto existente={activo} alCerrar={() => setEditandoMeta(false)} />
      )}
      {editandoOp && (
        <FormOperacion
          abierto
          alCerrar={() => setEditandoOp(undefined)}
          existente={editandoOp === 'nueva' ? undefined : editandoOp}
          activoSugerido={activo.id}
        />
      )}
    </div>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
      <span className="etiqueta" style={{ minWidth: 150, flex: 'none' }}>
        {etiqueta}
      </span>
      <span>{children}</span>
    </div>
  )
}
