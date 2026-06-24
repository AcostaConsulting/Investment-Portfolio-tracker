import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { useApp } from '../../state/store'
import { useUi } from '../../state/ui'
import { puedeAgregarEtiqueta } from '../../engine/etiquetas'
import {
  GEOGRAFIAS,
  SECTORES_ACCION,
  SECTORES_CRIPTO,
  type Activo,
  type ClaseActivo,
  type DetalleRentaFija,
  type Geografia,
  type InstrumentoRentaFija,
} from '../../engine/tipos'
import { esFechaIsoValida, hoyIso } from '../../engine/fechas'
import type { MetadatosEditables } from '../../engine/edicionActivo'

const CLASES: ClaseActivo[] = ['accion', 'cripto', 'renta_fija']
const INSTRUMENTOS: InstrumentoRentaFija[] = ['cetes', 'bono_m', 'udibono', 'pagare', 'sofipo', 'ahorro']
const MONEDAS_SUGERIDAS = ['MXN', 'USD', 'EUR', 'USDT', 'GBP', 'JPY', 'CAD']

export function FormActivo({
  abierto,
  alCerrar,
  alGuardar,
  existente,
  claseInicial,
}: {
  abierto: boolean
  alCerrar: () => void
  alGuardar?: (activo: Activo) => void
  existente?: Activo
  claseInicial?: ClaseActivo
}) {
  const { t } = useTranslation()
  const guardarActivo = useApp((s) => s.guardarActivo)
  const editarMetadatosActivo = useApp((s) => s.editarMetadatosActivo)
  const monedaBase = useApp((s) => s.doc.ajustes.monedaBase)
  const etiquetasDisponibles = useApp((s) => s.doc.etiquetas)
  const plan = useApp((s) => s.plan)
  const abrirModalPlanes = useUi((s) => s.abrirModalPlanes)

  const [simbolo, setSimbolo] = useState(existente?.simbolo ?? '')
  const [nombre, setNombre] = useState(existente?.nombre ?? '')
  const [clase, setClase] = useState<ClaseActivo>(existente?.clase ?? claseInicial ?? 'accion')
  const [moneda, setMoneda] = useState(existente?.moneda ?? monedaBase)
  const rf = existente?.rentaFija
  const [instrumento, setInstrumento] = useState<InstrumentoRentaFija>(rf?.instrumento ?? 'cetes')
  const [tasaAnual, setTasaAnual] = useState(rf ? String(rf.tasaAnual) : '')
  const [fechaInicio, setFechaInicio] = useState(rf?.fechaInicio ?? hoyIso())
  const [fechaVencimiento, setFechaVencimiento] = useState(rf?.fechaVencimiento ?? '')
  const [valorNominal, setValorNominal] = useState(rf?.valorNominal ? String(rf.valorNominal) : '')
  const [udiInicial, setUdiInicial] = useState(rf?.udiInicial ? String(rf.udiInicial) : '')
  const [tasaIsr, setTasaIsr] = useState(rf?.tasaIsr !== undefined ? String(rf.tasaIsr) : '')
  const [sector, setSector] = useState(existente?.sector ?? '')
  const [geografia, setGeografia] = useState<Geografia | ''>(existente?.geografia ?? '')
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>(existente?.etiquetaIds ?? [])
  const [liquido, setLiquido] = useState(existente?.liquido ?? true)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const esRF = clase === 'renta_fija'
  const esBono = instrumento === 'bono_m' || instrumento === 'udibono'
  const sinVencimiento = instrumento === 'ahorro'

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!simbolo.trim()) e.simbolo = t('formOperacion.requerido')
    if (!nombre.trim()) e.nombre = t('formOperacion.requerido')
    if (!moneda.trim()) e.moneda = t('formOperacion.requerido')
    if (esRF) {
      const tasa = Number(tasaAnual)
      if (!tasaAnual || !(tasa > 0)) e.tasaAnual = t('formOperacion.mayorQueCero')
      if (!esFechaIsoValida(fechaInicio)) e.fechaInicio = t('formOperacion.fechaInvalida')
      if (!sinVencimiento && !esFechaIsoValida(fechaVencimiento)) e.fechaVencimiento = t('formOperacion.fechaInvalida')
      if (instrumento === 'udibono' && udiInicial && !(Number(udiInicial) > 0))
        e.udiInicial = t('formOperacion.mayorQueCero')
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function guardar() {
    if (!validar()) return
    let rentaFija: DetalleRentaFija | undefined
    if (esRF) {
      rentaFija = {
        instrumento,
        tasaAnual: Number(tasaAnual),
        fechaInicio,
        ...(sinVencimiento ? {} : { fechaVencimiento }),
        ...(esBono && valorNominal ? { valorNominal: Number(valorNominal) } : {}),
        ...(instrumento === 'udibono' && udiInicial ? { udiInicial: Number(udiInicial) } : {}),
        ...(tasaIsr !== '' ? { tasaIsr: Number(tasaIsr) } : {}),
      }
    }
    if (existente) {
      // Edición: solo metadatos. El engine preserva id/símbolo/clase.
      const parche: MetadatosEditables = {
        nombre: nombre.trim(),
        moneda: moneda.trim().toUpperCase(),
        sector: sector && !esRF ? sector : undefined,
        geografia: geografia || undefined,
        etiquetaIds: etiquetaIds.length > 0 ? etiquetaIds : undefined,
        liquido,
        rentaFija: esRF ? rentaFija : undefined,
      }
      editarMetadatosActivo(existente.id, parche)
      alCerrar()
      return
    }

    const activo: Activo = {
      id: crypto.randomUUID(),
      simbolo: simbolo.trim().toUpperCase(),
      nombre: nombre.trim(),
      clase,
      moneda: moneda.trim().toUpperCase(),
      ...(rentaFija ? { rentaFija } : {}),
      ...(sector && !esRF ? { sector } : {}),
      ...(geografia ? { geografia } : {}),
      ...(etiquetaIds.length > 0 ? { etiquetaIds } : {}),
      ...(liquido ? {} : { liquido: false }),
    }
    guardarActivo(activo)
    alGuardar?.(activo)
    alCerrar()
  }

  return (
    <Modal
      titulo={existente ? t('formActivo.editarTitulo') : t('formActivo.nuevo')}
      abierto={abierto}
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
          <label>{t('comunes.simbolo')}</label>
          <input
            className={errores.simbolo ? 'invalido' : ''}
            value={simbolo}
            onChange={(e) => setSimbolo(e.target.value)}
            placeholder="AAPL, BTC, CETES-182"
            autoFocus={!existente}
            disabled={!!existente}
          />
          {errores.simbolo ? (
            <span className="error">{errores.simbolo}</span>
          ) : (
            <span className="ayuda">{existente ? t('formActivo.simboloFijo') : t('formActivo.simboloAyuda')}</span>
          )}
        </div>
        <div className="campo">
          <label>{t('comunes.nombre')}</label>
          <input className={errores.nombre ? 'invalido' : ''} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {errores.nombre && <span className="error">{errores.nombre}</span>}
        </div>
        <div className="campo">
          <label>{t('comunes.clase')}</label>
          <select value={clase} onChange={(e) => setClase(e.target.value as ClaseActivo)} disabled={!!existente}>
            {CLASES.map((c) => (
              <option key={c} value={c}>
                {t(`clases.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>{t('comunes.moneda')}</label>
          <input
            className={errores.moneda ? 'invalido' : ''}
            value={moneda}
            onChange={(e) => setMoneda(e.target.value.toUpperCase())}
            list="monedas-sugeridas"
            maxLength={5}
          />
          <datalist id="monedas-sugeridas">
            {MONEDAS_SUGERIDAS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {errores.moneda ? <span className="error">{errores.moneda}</span> : <span className="ayuda">{t('formActivo.monedaAyuda')}</span>}
        </div>

        {!esRF && (
          <div className="campo">
            <label>
              {t('clasificacion.sector')} <span className="suave">({t('comunes.opcional')})</span>
            </label>
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">{t('clasificacion.sinSector')}</option>
              {clase === 'accion'
                ? SECTORES_ACCION.map((s) => (
                    <option key={s} value={s}>
                      {t(`clasificacion.sectores.${s}`)}
                    </option>
                  ))
                : SECTORES_CRIPTO.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
            </select>
          </div>
        )}
        <div className="campo">
          <label>
            {t('clasificacion.geografia')} <span className="suave">({t('comunes.opcional')})</span>
          </label>
          <select value={geografia} onChange={(e) => setGeografia(e.target.value as Geografia | '')}>
            <option value="">—</option>
            {GEOGRAFIAS.map((g) => (
              <option key={g} value={g}>
                {t(`clasificacion.geografias.${g}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo ancho-completo">
          <label>{t('clasificacion.etiquetas')}</label>
          {etiquetasDisponibles.length === 0 ? (
            <span className="ayuda">{t('clasificacion.sinEtiquetasCreadas')}</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {etiquetasDisponibles.map((e) => {
                const activa = etiquetaIds.includes(e.id)
                const bloqueada = !activa && !puedeAgregarEtiqueta(plan, etiquetaIds.length)
                return (
                  <button
                    key={e.id}
                    type="button"
                    className="chip"
                    style={{
                      cursor: 'pointer',
                      borderColor: activa ? e.color : undefined,
                      background: activa ? `color-mix(in srgb, ${e.color} 18%, transparent)` : undefined,
                      color: activa ? e.color : undefined,
                      opacity: bloqueada ? 0.45 : 1,
                    }}
                    onClick={() => {
                      if (activa) setEtiquetaIds(etiquetaIds.filter((x) => x !== e.id))
                      else if (bloqueada) abrirModalPlanes()
                      else setEtiquetaIds([...etiquetaIds, e.id])
                    }}
                  >
                    {e.nombre}
                  </button>
                )
              })}
            </div>
          )}
          {!puedeAgregarEtiqueta(plan, etiquetaIds.length) && etiquetaIds.length > 0 && (
            <span className="ayuda">{t('clasificacion.limiteEtiquetas')}</span>
          )}
        </div>
        <div className="campo">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={liquido} onChange={(e) => setLiquido(e.target.checked)} />
            {t('clasificacion.liquido')}
          </label>
          <span className="ayuda">{t('clasificacion.liquidoAyuda')}</span>
        </div>

        {esRF && (
          <>
            <div className="campo">
              <label>{t('rentaFija.instrumento')}</label>
              <select value={instrumento} onChange={(e) => setInstrumento(e.target.value as InstrumentoRentaFija)}>
                {INSTRUMENTOS.map((i) => (
                  <option key={i} value={i}>
                    {t(`rentaFija.instrumentos.${i}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>{t('rentaFija.tasaAnual')} (%)</label>
              <input
                className={errores.tasaAnual ? 'invalido' : ''}
                type="number"
                step="0.01"
                min="0"
                value={tasaAnual}
                onChange={(e) => setTasaAnual(e.target.value)}
                placeholder="10.25"
              />
              {errores.tasaAnual && <span className="error">{errores.tasaAnual}</span>}
            </div>
            <div className="campo">
              <label>{t('rentaFija.fechaInicio')}</label>
              <input
                className={errores.fechaInicio ? 'invalido' : ''}
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
              {errores.fechaInicio && <span className="error">{errores.fechaInicio}</span>}
            </div>
            {!sinVencimiento && (
              <div className="campo">
                <label>{t('rentaFija.fechaVencimiento')}</label>
                <input
                  className={errores.fechaVencimiento ? 'invalido' : ''}
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                />
                {errores.fechaVencimiento && <span className="error">{errores.fechaVencimiento}</span>}
              </div>
            )}
            {esBono && (
              <div className="campo">
                <label>
                  {t('rentaFija.valorNominal')} <span className="suave">({t('comunes.opcional')})</span>
                </label>
                <input type="number" step="any" value={valorNominal} onChange={(e) => setValorNominal(e.target.value)} placeholder="100" />
              </div>
            )}
            {instrumento === 'udibono' && (
              <div className="campo">
                <label>{t('rentaFija.udiInicial')}</label>
                <input
                  className={errores.udiInicial ? 'invalido' : ''}
                  type="number"
                  step="any"
                  value={udiInicial}
                  onChange={(e) => setUdiInicial(e.target.value)}
                  placeholder="8.35"
                />
                {errores.udiInicial && <span className="error">{errores.udiInicial}</span>}
              </div>
            )}
            <div className="campo">
              <label>
                {t('rentaFija.tasaIsrPropia')} <span className="suave">({t('comunes.opcional')})</span>
              </label>
              <input type="number" step="0.01" min="0" value={tasaIsr} onChange={(e) => setTasaIsr(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
