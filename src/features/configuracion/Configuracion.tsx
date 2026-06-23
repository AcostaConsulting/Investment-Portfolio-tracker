import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { IDIOMAS } from '../../i18n'
import type { Idioma, Tema } from '../../state/documento'
import { tieneCapacidad } from '../../licencias/planes'
import { actualizarTodo } from '../../servicios/precios'
import {
  base64ATexto,
  deserializarRespaldo,
  serializarRespaldo,
  textoABase64,
} from '../../servicios/respaldo'
import { SeccionLicencia } from './SeccionLicencia'
import { GestionEtiquetas } from './GestionEtiquetas'
import { hoyIso } from '../../engine/fechas'

export function Configuracion() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const plan = useApp((s) => s.plan)
  const actualizarAjustes = useApp((s) => s.actualizarAjustes)
  const fijarPrecio = useApp((s) => s.fijarPrecio)
  const fijarTipoCambio = useApp((s) => s.fijarTipoCambio)
  const reemplazarDocumento = useApp((s) => s.reemplazarDocumento)
  const mutarDoc = useApp((s) => s.mutarDoc)
  const ajustes = doc.ajustes

  const [estadoPrecios, setEstadoPrecios] = useState<'' | 'cargando' | 'ok' | string>('')
  const [usarPin, setUsarPin] = useState(false)
  const [pin, setPin] = useState('')
  const [mensajeDatos, setMensajeDatos] = useState('')
  const [nuevaMoneda, setNuevaMoneda] = useState('')
  const [nuevoTc, setNuevoTc] = useState('')
  const [gestionandoEtiquetas, setGestionandoEtiquetas] = useState(false)

  const puedePreciosEnVivo = tieneCapacidad(plan, 'preciosEnVivo')

  async function actualizarPrecios() {
    setEstadoPrecios('cargando')
    try {
      const r = await actualizarTodo(doc)
      for (const [activoId, precio] of Object.entries(r.preciosNuevos)) fijarPrecio(activoId, precio)
      for (const [moneda, tc] of Object.entries(r.tiposCambioNuevos)) fijarTipoCambio(moneda, tc)
      setEstadoPrecios(r.errores.length > 0 ? r.errores.join(' · ') : 'ok')
    } catch (e) {
      setEstadoPrecios(e instanceof Error ? e.message : t('errores.redFallo'))
    }
  }

  async function respaldar() {
    setMensajeDatos('')
    const texto = await serializarRespaldo(doc, usarPin && pin ? pin : undefined)
    const r = await window.api?.dialogo.guardar({
      sugerido: `tracker-portafolio-${hoyIso()}.json`,
      filtros: [{ nombre: 'JSON', extensiones: ['json'] }],
      contenidoBase64: textoABase64(texto),
    })
    if (r?.guardado) setMensajeDatos(t('configuracion.respaldoListo'))
  }

  async function restaurar() {
    setMensajeDatos('')
    const r = await window.api?.dialogo.abrir({ filtros: [{ nombre: 'JSON', extensiones: ['json'] }] })
    if (!r?.abierto || !r.contenidoBase64) return
    const texto = base64ATexto(r.contenidoBase64)
    let resultado = await deserializarRespaldo(texto, usarPin && pin ? pin : undefined)
    if (!resultado.ok && resultado.error === 'pin_requerido') {
      const pedido = window.prompt(t('configuracion.pin'))
      if (!pedido) return
      resultado = await deserializarRespaldo(texto, pedido)
    }
    if (!resultado.ok) {
      setMensajeDatos(resultado.error === 'invalido' ? t('configuracion.archivoInvalido') : t('configuracion.pinIncorrecto'))
      return
    }
    if (!window.confirm(t('configuracion.restaurarConfirma'))) return
    reemplazarDocumento(resultado.documento)
    setMensajeDatos(t('configuracion.restauracionLista'))
  }

  function agregarTipoCambio() {
    const m = nuevaMoneda.trim().toUpperCase()
    if (!m || m === ajustes.monedaBase || !(Number(nuevoTc) > 0)) return
    fijarTipoCambio(m, Number(nuevoTc))
    setNuevaMoneda('')
    setNuevoTc('')
  }

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('configuracion.titulo')}</h1>
      </div>

      {/* ---------- General ---------- */}
      <div className="tarjeta" data-tour="config-general">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('configuracion.general')}
        </div>
        <div className="form-rejilla">
          <div className="campo">
            <label>{t('configuracion.idioma')}</label>
            <select value={ajustes.idioma} onChange={(e) => actualizarAjustes({ idioma: e.target.value as Idioma })}>
              {IDIOMAS.map((i) => (
                <option key={i.codigo} value={i.codigo}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>{t('configuracion.tema')}</label>
            <select value={ajustes.tema} onChange={(e) => actualizarAjustes({ tema: e.target.value as Tema })}>
              <option value="claro">{t('configuracion.temaClaro')}</option>
              <option value="oscuro">{t('configuracion.temaOscuro')}</option>
              <option value="sistema">{t('configuracion.temaSistema')}</option>
            </select>
          </div>
          <div className="campo">
            <label>{t('configuracion.monedaBase')}</label>
            <input
              value={ajustes.monedaBase}
              maxLength={5}
              onChange={(e) => actualizarAjustes({ monedaBase: e.target.value.toUpperCase() })}
            />
            <span className="ayuda">{t('configuracion.monedaBaseAyuda')}</span>
          </div>
        </div>
      </div>

      {/* ---------- Renta fija ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('configuracion.rentaFijaSeccion')}
        </div>
        <div className="form-rejilla">
          <div className="campo">
            <label>{t('configuracion.tasaIsr')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ajustes.tasaIsrAnual}
              onChange={(e) => actualizarAjustes({ tasaIsrAnual: Number(e.target.value) || 0 })}
            />
            <span className="ayuda">{t('configuracion.tasaIsrAyuda')}</span>
          </div>
          <div className="campo">
            <label>{t('configuracion.udiActual')}</label>
            <input
              type="number"
              step="any"
              min="0"
              value={ajustes.udiActual ?? ''}
              onChange={(e) =>
                actualizarAjustes({ udiActual: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="8.35"
            />
          </div>
          <div className="campo">
            <label>{t('configuracion.diasAlerta')}</label>
            <input
              type="number"
              min="1"
              value={ajustes.diasAlertaVencimiento}
              onChange={(e) => actualizarAjustes({ diasAlertaVencimiento: Number(e.target.value) || 30 })}
            />
          </div>
        </div>
      </div>

      {/* ---------- Clasificación ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('clasificacion.etiquetas')}
        </div>
        <button className="btn" onClick={() => setGestionandoEtiquetas(true)}>
          {t('clasificacion.gestionEtiquetas')}
        </button>
        {gestionandoEtiquetas && <GestionEtiquetas alCerrar={() => setGestionandoEtiquetas(false)} />}
      </div>

      {/* ---------- Tipos de cambio ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 6 }}>
          {t('configuracion.tiposCambio')}
        </div>
        <p className="mini suave" style={{ margin: '0 0 12px' }}>
          {t('configuracion.tiposCambioAyuda', { base: ajustes.monedaBase })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
          {Object.entries(doc.tiposCambio).map(([moneda, tc]) => (
            <div key={moneda} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="chip" style={{ width: 52, justifyContent: 'center' }}>
                {moneda}
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={tc}
                style={{ flex: 1 }}
                onChange={(e) => Number(e.target.value) > 0 && fijarTipoCambio(moneda, Number(e.target.value))}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="USD"
              maxLength={5}
              value={nuevaMoneda}
              style={{ width: 80 }}
              onChange={(e) => setNuevaMoneda(e.target.value.toUpperCase())}
            />
            <input
              type="number"
              step="any"
              min="0"
              placeholder="18.50"
              value={nuevoTc}
              style={{ flex: 1 }}
              onChange={(e) => setNuevoTc(e.target.value)}
            />
            <button className="btn" onClick={agregarTipoCambio}>
              {t('configuracion.agregarMoneda')}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Red (opt-in) ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('configuracion.red')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ajustes.preciosEnVivo}
              disabled={!puedePreciosEnVivo}
              onChange={(e) => actualizarAjustes({ preciosEnVivo: e.target.checked })}
            />
            <span>
              <strong>{t('configuracion.preciosEnVivo')}</strong>
              {!puedePreciosEnVivo && (
                <span className="chip acento" style={{ marginLeft: 8 }}>
                  Pro
                </span>
              )}
              <br />
              <span className="mini suave">{t('configuracion.preciosEnVivoAyuda')}</span>
            </span>
          </label>
          {ajustes.preciosEnVivo && puedePreciosEnVivo && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn" onClick={() => void actualizarPrecios()} disabled={estadoPrecios === 'cargando'}>
                {estadoPrecios === 'cargando' ? t('configuracion.actualizando') : t('configuracion.actualizarAhora')}
              </button>
              {estadoPrecios === 'ok' && <span className="mini positivo">{t('configuracion.preciosActualizados')}</span>}
              {estadoPrecios && estadoPrecios !== 'ok' && estadoPrecios !== 'cargando' && (
                <span className="mini" style={{ color: 'var(--loss)' }}>
                  {estadoPrecios}
                </span>
              )}
            </div>
          )}
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ajustes.buscarActualizaciones}
              onChange={(e) => actualizarAjustes({ buscarActualizaciones: e.target.checked })}
            />
            <span>
              <strong>{t('configuracion.actualizaciones')}</strong>
              <br />
              <span className="mini suave">{t('configuracion.actualizacionesAyuda')}</span>
            </span>
          </label>
          {ajustes.buscarActualizaciones && <Actualizador />}
        </div>
      </div>

      {/* ---------- Notificaciones ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('configuracion.notificaciones')}
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ajustes.notificacionesAlertas}
            onChange={(e) => actualizarAjustes({ notificacionesAlertas: e.target.checked })}
          />
          <span>
            <strong>{t('configuracion.notificacionesAlertas')}</strong>
            <br />
            <span className="mini suave">{t('configuracion.notificacionesAlertasAyuda')}</span>
          </span>
        </label>
      </div>

      {/* ---------- Datos ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 12 }}>
          {t('configuracion.datos')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={usarPin} onChange={(e) => setUsarPin(e.target.checked)} />
            <span>{t('configuracion.respaldoCifrado')}</span>
          </label>
          {usarPin && (
            <div className="campo" style={{ maxWidth: 220 }}>
              <label>{t('configuracion.pin')}</label>
              <input type="password" value={pin} minLength={4} onChange={(e) => setPin(e.target.value)} />
              <span className="ayuda">{t('configuracion.pinAyuda')}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => void respaldar()} disabled={usarPin && pin.length < 4}>
              {t('configuracion.respaldar')}
            </button>
            <button className="btn" onClick={() => void restaurar()}>
              {t('configuracion.restaurar')}
            </button>
          </div>
          {mensajeDatos && <span className="mini suave">{mensajeDatos}</span>}
          <button
            className="btn btn-fantasma"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => mutarDoc((d) => ({ ...d, tourCompletado: false }))}
          >
            {t('configuracion.verTour')}
          </button>
        </div>
      </div>

      {/* ---------- Licencia ---------- */}
      <SeccionLicencia />

      {/* ---------- Acerca de ---------- */}
      <div className="tarjeta">
        <div className="etiqueta" style={{ marginBottom: 8 }}>
          {t('configuracion.acerca')}
        </div>
        <AcercaDe />
      </div>
    </div>
  )
}

function Actualizador() {
  const { t } = useTranslation()
  const [estado, setEstado] = useState<
    '' | 'buscando' | 'ninguna' | 'descargando' | 'lista' | { disponible: string } | { error: string }
  >('')

  async function buscar() {
    setEstado('buscando')
    const r = await window.api?.actualizador.buscar()
    if (!r || r.estado === 'sin-actualizacion') setEstado('ninguna')
    else if (r.estado === 'disponible' && r.version) setEstado({ disponible: r.version })
    else if (r.estado === 'error') setEstado({ error: r.error ?? t('errores.redFallo') })
  }

  async function descargar() {
    setEstado('descargando')
    const r = await window.api?.actualizador.descargar()
    if (r?.estado === 'lista') {
      await window.api?.actualizador.instalarAlCerrar()
      setEstado('lista')
    } else {
      setEstado({ error: r?.error ?? t('errores.redFallo') })
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn" onClick={() => void buscar()} disabled={estado === 'buscando' || estado === 'descargando'}>
        {t('configuracion.buscarActualizacion')}
      </button>
      {estado === 'ninguna' && <span className="mini suave">{t('configuracion.actualizacionNinguna')}</span>}
      {typeof estado === 'object' && 'disponible' in estado && (
        <>
          <span className="chip acento">{t('configuracion.actualizacionDisponible', { version: estado.disponible })}</span>
          <button className="btn btn-primario btn-mini" onClick={() => void descargar()}>
            {t('configuracion.actualizacionDescargar')}
          </button>
        </>
      )}
      {estado === 'descargando' && <span className="mini suave">{t('configuracion.actualizando')}</span>}
      {estado === 'lista' && <span className="mini positivo">{t('configuracion.actualizacionLista')}</span>}
      {typeof estado === 'object' && 'error' in estado && (
        <span className="mini" style={{ color: 'var(--loss)' }}>
          {estado.error}
        </span>
      )}
    </div>
  )
}

function AcercaDe() {
  const { t } = useTranslation()
  const [version, setVersion] = useState('')
  if (!version) {
    void window.api?.sistema.info().then((i) => setVersion(i.version))
  }
  return (
    <p className="mini suave" style={{ margin: 0 }}>
      {t('app.nombre')} {version && `· ${t('configuracion.version')} ${version}`}
      <br />
      {t('configuracion.hechoEn')}
    </p>
  )
}
