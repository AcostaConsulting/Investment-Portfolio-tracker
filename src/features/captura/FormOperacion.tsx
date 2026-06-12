import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { FormActivo } from './FormActivo'
import { useApp } from '../../state/store'
import { tipoCambioHistorico } from '../../servicios/precios'
import type { Activo, Operacion, TipoOperacion } from '../../engine/tipos'
import { OPERACIONES_EFECTIVO } from '../../engine/tipos'
import { esFechaIsoValida, hoyIso } from '../../engine/fechas'

const TIPOS: TipoOperacion[] = [
  'compra',
  'venta',
  'dividendo',
  'interes',
  'staking',
  'ajuste',
  'airdrop',
  'recompensa',
]

export function FormOperacion({
  abierto,
  alCerrar,
  existente,
  activoSugerido,
}: {
  abierto: boolean
  alCerrar: () => void
  existente?: Operacion
  activoSugerido?: string
}) {
  const { t } = useTranslation()
  const activos = useApp((s) => s.doc.activos)
  const monedaBase = useApp((s) => s.doc.ajustes.monedaBase)
  const guardarOperacion = useApp((s) => s.guardarOperacion)

  const [activoId, setActivoId] = useState(existente?.activoId ?? activoSugerido ?? activos[0]?.id ?? '')
  const [tipo, setTipo] = useState<TipoOperacion>(existente?.tipo ?? 'compra')
  const [fecha, setFecha] = useState(existente?.fecha ?? hoyIso())
  const [cantidad, setCantidad] = useState(existente ? String(existente.cantidad) : '')
  const [precio, setPrecio] = useState(existente ? String(existente.precioUnitario) : '')
  const [moneda, setMoneda] = useState(existente?.moneda ?? '')
  const [tipoCambio, setTipoCambio] = useState(existente ? String(existente.tipoCambio) : '')
  const [comision, setComision] = useState(existente?.comision ? String(existente.comision) : '')
  const [nota, setNota] = useState(existente?.nota ?? '')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [creandoActivo, setCreandoActivo] = useState(false)
  // Al editar una operación se respeta el TC capturado; en altas nuevas
  // se sugiere el TC histórico de la fecha (desactivable).
  const [usarTcFecha, setUsarTcFecha] = useState(!existente)
  const [tcEstado, setTcEstado] = useState<'' | 'cargando' | 'error'>('')

  const activo = useMemo(() => activos.find((a) => a.id === activoId), [activos, activoId])

  // Al elegir activo, la moneda hereda la del activo (editable).
  useEffect(() => {
    if (!existente && activo) setMoneda(activo.moneda)
  }, [activo, existente])

  const esBase = moneda.trim().toUpperCase() === monedaBase
  useEffect(() => {
    if (esBase) setTipoCambio('1')
  }, [esBase])

  // TC histórico de Frankfurter para la fecha de la operación.
  useEffect(() => {
    if (esBase || !usarTcFecha || !esFechaIsoValida(fecha) || moneda.trim().length < 3) return
    let cancelado = false
    setTcEstado('cargando')
    tipoCambioHistorico(fecha, moneda.trim().toUpperCase(), monedaBase)
      .then((tc) => {
        if (cancelado) return
        if (tc !== undefined) {
          setTipoCambio(String(tc))
          setTcEstado('')
        } else {
          setTcEstado('error')
        }
      })
      .catch(() => {
        if (!cancelado) setTcEstado('error')
      })
    return () => {
      cancelado = true
    }
  }, [esBase, usarTcFecha, fecha, moneda, monedaBase])

  const esEfectivo = OPERACIONES_EFECTIVO.has(tipo)
  const esAjuste = tipo === 'ajuste'

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!activoId) e.activoId = t('formOperacion.sinActivos')
    if (!esFechaIsoValida(fecha)) e.fecha = t('formOperacion.fechaInvalida')
    const c = Number(cantidad)
    if (cantidad === '' || Number.isNaN(c)) e.cantidad = t('formOperacion.requerido')
    else if (esAjuste ? c === 0 : c <= 0) e.cantidad = esAjuste ? t('formOperacion.distintoDeCero') : t('formOperacion.mayorQueCero')
    const p = Number(precio)
    if (precio === '' || Number.isNaN(p) || p < 0) e.precio = t('formOperacion.requerido')
    if (!moneda.trim()) e.moneda = t('formOperacion.requerido')
    const tc = Number(tipoCambio)
    if (tipoCambio === '' || !(tc > 0)) e.tipoCambio = t('formOperacion.mayorQueCero')
    if (comision !== '' && Number(comision) < 0) e.comision = t('formOperacion.mayorQueCero')
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function guardar() {
    if (!validar()) return
    const operacion: Operacion = {
      id: existente?.id ?? crypto.randomUUID(),
      activoId,
      tipo,
      fecha,
      cantidad: Number(cantidad),
      precioUnitario: Number(precio),
      moneda: moneda.trim().toUpperCase(),
      tipoCambio: Number(tipoCambio),
      ...(comision !== '' && Number(comision) > 0 ? { comision: Number(comision) } : {}),
      ...(nota.trim() ? { nota: nota.trim() } : {}),
    }
    guardarOperacion(operacion)
    alCerrar()
  }

  function alCrearActivo(nuevo: Activo) {
    setActivoId(nuevo.id)
    setMoneda(nuevo.moneda)
  }

  return (
    <>
      <Modal
        titulo={existente ? t('movimientos.editarTitulo') : t('movimientos.nuevo')}
        abierto={abierto && !creandoActivo}
        alCerrar={alCerrar}
        pie={
          <>
            <button className="btn" onClick={alCerrar}>
              {t('comunes.cancelar')}
            </button>
            <button className="btn btn-primario" onClick={guardar}>
              {t('comunes.guardar')}
            </button>
          </>
        }
      >
        <div className="form-rejilla">
          <div className="campo">
            <label>{t('formOperacion.activo')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                style={{ flex: 1 }}
                className={errores.activoId ? 'invalido' : ''}
                value={activoId}
                onChange={(e) => setActivoId(e.target.value)}
              >
                {activos.length === 0 && <option value="">—</option>}
                {activos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.simbolo} · {a.nombre}
                  </option>
                ))}
              </select>
              <button className="btn" onClick={() => setCreandoActivo(true)} title={t('formOperacion.nuevoActivo')}>
                +
              </button>
            </div>
            {errores.activoId && <span className="error">{errores.activoId}</span>}
          </div>
          <div className="campo">
            <label>{t('comunes.tipo')}</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoOperacion)}>
              {TIPOS.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`operaciones.${tp}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>{t('comunes.fecha')}</label>
            <input className={errores.fecha ? 'invalido' : ''} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            {errores.fecha && <span className="error">{errores.fecha}</span>}
          </div>
          <div className="campo">
            <label>{t('comunes.cantidad')}</label>
            <input
              className={errores.cantidad ? 'invalido' : ''}
              type="number"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            {errores.cantidad ? (
              <span className="error">{errores.cantidad}</span>
            ) : esAjuste ? (
              <span className="ayuda">{t('formOperacion.cantidadAjusteAyuda')}</span>
            ) : esEfectivo ? (
              <span className="ayuda">{t('formOperacion.importeAyudaEfectivo')}</span>
            ) : null}
          </div>
          <div className="campo">
            <label>{t('formOperacion.precioUnitario')}</label>
            <input
              className={errores.precio ? 'invalido' : ''}
              type="number"
              step="any"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
            {errores.precio && <span className="error">{errores.precio}</span>}
          </div>
          <div className="campo">
            <label>{t('comunes.moneda')}</label>
            <input
              className={errores.moneda ? 'invalido' : ''}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value.toUpperCase())}
              maxLength={5}
            />
            {errores.moneda && <span className="error">{errores.moneda}</span>}
          </div>
          {!esBase && (
            <div className="campo">
              <label>{t('formOperacion.tipoCambio', { base: monedaBase })}</label>
              <label className="mini" style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', fontWeight: 400 }}>
                <input
                  type="checkbox"
                  style={{ width: 13, height: 13 }}
                  checked={usarTcFecha}
                  onChange={(e) => {
                    setUsarTcFecha(e.target.checked)
                    if (!e.target.checked) setTcEstado('')
                  }}
                />
                {t('formOperacion.usarTcFecha')}
              </label>
              <input
                className={errores.tipoCambio ? 'invalido' : ''}
                type="number"
                step="any"
                value={tipoCambio}
                onChange={(e) => {
                  setTipoCambio(e.target.value)
                  setUsarTcFecha(false)
                }}
                placeholder={tcEstado === 'cargando' ? '…' : undefined}
              />
              {errores.tipoCambio ? (
                <span className="error">{errores.tipoCambio}</span>
              ) : tcEstado === 'error' ? (
                <span className="error">{t('formOperacion.tcError')}</span>
              ) : tcEstado === 'cargando' ? (
                <span className="ayuda">{t('formOperacion.tcCargando')}</span>
              ) : (
                <span className="ayuda">{t('formOperacion.tipoCambioAyuda', { moneda: moneda || '?', base: monedaBase })}</span>
              )}
            </div>
          )}
          <div className="campo">
            <label>
              {t('comunes.comision')} <span className="suave">({t('comunes.opcional')})</span>
            </label>
            <input
              className={errores.comision ? 'invalido' : ''}
              type="number"
              step="any"
              min="0"
              value={comision}
              onChange={(e) => setComision(e.target.value)}
            />
            {errores.comision && <span className="error">{errores.comision}</span>}
          </div>
          <div className="campo ancho-completo">
            <label>
              {t('comunes.nota')} <span className="suave">({t('comunes.opcional')})</span>
            </label>
            <input value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
        </div>
      </Modal>
      {creandoActivo && (
        <FormActivo abierto alCerrar={() => setCreandoActivo(false)} alGuardar={alCrearActivo} />
      )}
    </>
  )
}
