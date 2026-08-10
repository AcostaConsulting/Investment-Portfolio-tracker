import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { FormActivo } from './FormActivo'
import { useApp } from '../../state/store'
import { tipoCambioHistorico } from '../../servicios/precios'
import { tcDofHistorico } from '../../servicios/tcDof'
import type { Activo, Operacion, TipoOperacion } from '../../engine/tipos'
import { OPERACIONES_EFECTIVO } from '../../engine/tipos'
import { esFechaIsoValida, hoyIso } from '../../engine/fechas'
import { numeroOUndefined } from '../../engine/numero'
import { CampoNumero } from '../../ui/CampoNumero'

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
  const [importe, setImporte] = useState(
    existente?.importeEfectivo !== undefined ? String(existente.importeEfectivo) : '',
  )
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
  // Fecha de determinación del FIX cuando el TC vino del DOF, para poder
  // decirle al usuario de qué día es el número y no sólo ponérselo.
  const [tcFechaDof, setTcFechaDof] = useState<string | undefined>()

  const activo = useMemo(() => activos.find((a) => a.id === activoId), [activos, activoId])

  // Al elegir activo, la moneda hereda la del activo (editable).
  useEffect(() => {
    if (!existente && activo) setMoneda(activo.moneda)
  }, [activo, existente])

  const esBase = moneda.trim().toUpperCase() === monedaBase
  useEffect(() => {
    if (esBase) setTipoCambio('1')
  }, [esBase])

  // TC sugerido para la fecha de la operación.
  //
  // Primero se intenta el del DOF, que es el que tiene efecto fiscal: el FIX
  // determinado dos días hábiles antes (§19.2). Viene de la serie empaquetada,
  // así que para USD→MXN esto NO toca la red.
  //
  // Si no aplica —otro par de monedas, o una fecha posterior a la serie que
  // trae este release— se cae a la fuente de siempre, que es una referencia de
  // mercado y no el TC fiscal. Por eso la UI dice de dónde salió cada número.
  useEffect(() => {
    if (esBase || !usarTcFecha || !esFechaIsoValida(fecha) || moneda.trim().length < 3) return
    let cancelado = false
    setTcEstado('cargando')
    const de = moneda.trim().toUpperCase()

    void (async () => {
      try {
        const dof = await tcDofHistorico(fecha, de, monedaBase)
        if (cancelado) return
        if (dof) {
          setTipoCambio(String(dof.tasa))
          setTcFechaDof(dof.fechaFix)
          setTcEstado('')
          return
        }
        const tc = await tipoCambioHistorico(fecha, de, monedaBase)
        if (cancelado) return
        setTcFechaDof(undefined)
        if (tc !== undefined) {
          setTipoCambio(String(tc))
          setTcEstado('')
        } else {
          setTcEstado('error')
        }
      } catch {
        if (!cancelado) {
          setTcFechaDof(undefined)
          setTcEstado('error')
        }
      }
    })()

    return () => {
      cancelado = true
    }
  }, [esBase, usarTcFecha, fecha, moneda, monedaBase])

  /**
   * Lee un campo con la regla compartida de `engine/numero.ts`, no con
   * `Number()`: `Number('1,5')` da NaN y `<input type="number">` daba 15
   * (AUDITORIA-ROBUSTEZ.md #4). `undefined` = vacío, ambiguo o ilegible; el
   * campo ya explica cuál de los tres.
   */
  const leer = (texto: string): number | undefined => numeroOUndefined(texto)

  /**
   * Mensaje para un campo que no se pudo leer. Si está en blanco, es que falta;
   * si tiene algo escrito, `CampoNumero` ya explica POR QUÉ no se pudo leer
   * (ambiguo o ilegible) y repetirlo aquí sólo apila dos avisos. Devuelve
   * cadena vacía: bloquea el guardado sin pintar un segundo mensaje.
   */
  const sinLeer = (texto: string): string => (texto.trim() === '' ? t('formOperacion.requerido') : '')

  const esEfectivo = OPERACIONES_EFECTIVO.has(tipo)
  const esAjuste = tipo === 'ajuste'

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!activoId) e.activoId = t('formOperacion.sinActivos')
    if (!esFechaIsoValida(fecha)) e.fecha = t('formOperacion.fechaInvalida')
    if (esEfectivo) {
      const im = leer(importe)
      if (im === undefined) e.importe = sinLeer(importe)
      else if (im <= 0) e.importe = t('formOperacion.mayorQueCero')
    } else {
      const c = leer(cantidad)
      if (c === undefined) e.cantidad = sinLeer(cantidad)
      else if (esAjuste ? c === 0 : c <= 0) e.cantidad = esAjuste ? t('formOperacion.distintoDeCero') : t('formOperacion.mayorQueCero')
      const p = leer(precio)
      if (p === undefined) e.precio = sinLeer(precio)
      else if (p < 0) e.precio = t('formOperacion.requerido')
    }
    if (!moneda.trim()) e.moneda = t('formOperacion.requerido')
    const tc = leer(tipoCambio)
    if (tc === undefined) e.tipoCambio = sinLeer(tipoCambio)
    else if (!(tc > 0)) e.tipoCambio = t('formOperacion.mayorQueCero')
    const com = leer(comision)
    if (comision.trim() !== '' && (com === undefined || com < 0)) e.comision = t('formOperacion.mayorQueCero')
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
      cantidad: esEfectivo ? 0 : (leer(cantidad) ?? 0),
      precioUnitario: esEfectivo ? 0 : (leer(precio) ?? 0),
      moneda: moneda.trim().toUpperCase(),
      tipoCambio: leer(tipoCambio) ?? 1,
      ...(esEfectivo ? { importeEfectivo: leer(importe) ?? 0 } : {}),
      ...((leer(comision) ?? 0) > 0 ? { comision: leer(comision)! } : {}),
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
          {esEfectivo ? (
            <div className="campo">
              <label>{t('comunes.importe')}</label>
              <CampoNumero
                valor={importe}
                alCambiar={setImporte}
                invalido={!!errores.importe}
                ayuda={t('formOperacion.importeAyudaEfectivo')}
              />
              {errores.importe && <span className="error">{errores.importe}</span>}
            </div>
          ) : (
            <>
              <div className="campo">
                <label>{t('comunes.cantidad')}</label>
                <CampoNumero
                  valor={cantidad}
                  alCambiar={setCantidad}
                  invalido={!!errores.cantidad}
                  ayuda={esAjuste ? t('formOperacion.cantidadAjusteAyuda') : undefined}
                />
                {errores.cantidad && <span className="error">{errores.cantidad}</span>}
              </div>
              <div className="campo">
                <label>{t('formOperacion.precioUnitario')}</label>
                <CampoNumero valor={precio} alCambiar={setPrecio} invalido={!!errores.precio} />
                {errores.precio && <span className="error">{errores.precio}</span>}
              </div>
            </>
          )}
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
              <CampoNumero
                valor={tipoCambio}
                alCambiar={(texto) => {
                  setTipoCambio(texto)
                  setUsarTcFecha(false)
                }}
                invalido={!!errores.tipoCambio}
                placeholder={tcEstado === 'cargando' ? '…' : undefined}
              />
              {errores.tipoCambio ? (
                <span className="error">{errores.tipoCambio}</span>
              ) : tcEstado === 'error' ? (
                <span className="error">{t('formOperacion.tcError')}</span>
              ) : tcEstado === 'cargando' ? (
                <span className="ayuda">{t('formOperacion.tcCargando')}</span>
              ) : tcFechaDof ? (
                // El número tiene efecto fiscal: decir de qué día es y de dónde
                // sale, no sólo ponerlo. Es la diferencia entre un dato y un
                // dato defendible ante el contador.
                <span className="ayuda">{t('formOperacion.tcDof', { fecha: tcFechaDof })}</span>
              ) : (
                <span className="ayuda">{t('formOperacion.tipoCambioAyuda', { moneda: moneda || '?', base: monedaBase })}</span>
              )}
            </div>
          )}
          <div className="campo">
            <label>
              {t('comunes.comision')} <span className="suave">({t('comunes.opcional')})</span>
            </label>
            <CampoNumero valor={comision} alCambiar={setComision} invalido={!!errores.comision} />
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
