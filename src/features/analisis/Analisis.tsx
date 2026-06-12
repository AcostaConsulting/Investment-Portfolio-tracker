/**
 * Pantalla Análisis: secciones colapsables gateadas por plan.
 * Diversificación y eventos fiscales son para todos; alertas, comisiones,
 * liquidez y benchmarks son Pro+; metas y rebalanceo, Premium.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import {
  useAlertasDisparadas,
  useCambioPortafolio,
  useDiversificacion,
  usePortafolio,
} from '../../state/selectores'
import { PuertaPremium } from '../../ui/PuertaPremium'
import { Cifra, Porcentaje } from '../../ui/Cifra'
import { Icono } from '../../ui/Icono'
import { DIMENSIONES, GraficaDiversificacion } from '../../ui/GraficaDiversificacion'
import { Modal } from '../../ui/Modal'
import { cambioBenchmark } from '../../servicios/precios'
import { formatoFecha, formatoMoneda, formatoPct } from '../../ui/formato'
import { calcularLiquidez } from '../../engine/liquidez'
import { evaluarMetas } from '../../engine/metas'
import { eventosFiscales, resumirEventos, type TipoEventoFiscal } from '../../engine/fiscal'
import { hoyIso, esFechaIsoValida } from '../../engine/fechas'
import { abrirExterno } from '../../lib/externo'
import { URL_CONSULTORIA } from '../../config/planes'
import type { ClaseActivo } from '../../engine/tipos'
import type { Meta } from '../../state/documento'

const CLASES: ClaseActivo[] = ['accion', 'cripto', 'renta_fija']

export function Analisis() {
  const { t } = useTranslation()
  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('analisis.titulo')}</h1>
      </div>

      <Seccion titulo={t('clasificacion.diversificacion')} abiertaDefault>
        <Diversificacion />
      </Seccion>

      <Seccion titulo={t('alertasPrecio.titulo')}>
        <PuertaPremium capacidad="alertasPrecio">
          <Alertas />
        </PuertaPremium>
      </Seccion>

      <Seccion titulo={t('analisis.comisiones')}>
        <PuertaPremium capacidad="analisisComisiones">
          <Comisiones />
        </PuertaPremium>
      </Seccion>

      <Seccion titulo={t('analisis.liquidez')}>
        <PuertaPremium capacidad="liquidez">
          <Liquidez />
        </PuertaPremium>
      </Seccion>

      <Seccion titulo={t('analisis.benchmarks')}>
        <PuertaPremium capacidad="benchmarks">
          <Benchmarks />
        </PuertaPremium>
      </Seccion>

      <Seccion titulo={t('metas.titulo')}>
        <PuertaPremium capacidad="metas">
          <Metas />
        </PuertaPremium>
      </Seccion>

      <Seccion titulo={t('analisis.rebalanceo')}>
        <PuertaPremium capacidad="rebalanceo">
          <Rebalanceo />
        </PuertaPremium>
      </Seccion>

      <Seccion titulo={t('fiscal.titulo')}>
        <Fiscal />
      </Seccion>
    </div>
  )
}

function Seccion({
  titulo,
  abiertaDefault = false,
  children,
}: {
  titulo: string
  abiertaDefault?: boolean
  children: ReactNode
}) {
  const [abierta, setAbierta] = useState(abiertaDefault)
  return (
    <div className="seccion-colapsable tarjeta" style={{ padding: 0 }}>
      <button className="seccion-cabecera" onClick={() => setAbierta(!abierta)}>
        <span className="etiqueta">{titulo}</span>
        <span style={{ transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }}>
          <Icono nombre="flecha" tam={14} />
        </span>
      </button>
      {abierta && <div className="seccion-cuerpo">{children}</div>}
    </div>
  )
}

/* ---------------- Diversificación (todos los planes) ---------------- */

function Diversificacion() {
  const { t } = useTranslation()
  const vista = useDiversificacion()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 18 }}>
      {DIMENSIONES.map((d) => (
        <div key={d}>
          <div className="etiqueta" style={{ marginBottom: 8 }}>
            {t(
              d === 'clase'
                ? 'comunes.clase'
                : d === 'sector'
                  ? 'clasificacion.sector'
                  : d === 'geografia'
                    ? 'clasificacion.geografia'
                    : 'clasificacion.etiquetas',
            )}
          </div>
          <GraficaDiversificacion vista={vista} dimension={d} tam={120} />
        </div>
      ))}
    </div>
  )
}

/* ---------------- Alertas de precio (Pro+) ---------------- */

function Alertas() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const guardarAlertaPrecio = useApp((s) => s.guardarAlertaPrecio)
  const eliminarAlertaPrecio = useApp((s) => s.eliminarAlertaPrecio)
  const disparadas = useAlertasDisparadas()
  const porActivo = useMemo(() => new Map(doc.activos.map((a) => [a.id, a])), [doc.activos])

  const [activoId, setActivoId] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const valida = activoId !== '' && (Number(min) > 0 || Number(max) > 0)

  function agregar() {
    if (!valida) return
    guardarAlertaPrecio({
      id: crypto.randomUUID(),
      activoId,
      ...(Number(min) > 0 ? { precioMin: Number(min) } : {}),
      ...(Number(max) > 0 ? { precioMax: Number(max) } : {}),
      activa: true,
    })
    setMin('')
    setMax('')
  }

  const candidatos = doc.activos.filter((a) => a.clase !== 'renta_fija')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {disparadas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {disparadas.map((d) => (
            <span key={`${d.configId}-${d.tipo}`} className="chip ambar">
              {t(d.tipo === 'min' ? 'alertasPrecio.disparadaMin' : 'alertasPrecio.disparadaMax', {
                simbolo: d.simbolo,
                precio: formatoMoneda(d.precioActual, d.moneda),
                umbral: formatoMoneda(d.umbral, d.moneda),
              })}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ minWidth: 160 }}>
          <label>{t('comunes.activo')}</label>
          <select value={activoId} onChange={(e) => setActivoId(e.target.value)}>
            <option value="">—</option>
            {candidatos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.simbolo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ width: 130 }}>
          <label>{t('alertasPrecio.precioMin')}</label>
          <input type="number" step="any" min="0" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div className="campo" style={{ width: 130 }}>
          <label>{t('alertasPrecio.precioMax')}</label>
          <input type="number" step="any" min="0" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <button className="btn btn-primario" onClick={agregar} disabled={!valida}>
          {t('comunes.agregar')}
        </button>
      </div>

      {doc.alertasPrecio.length === 0 ? (
        <span className="mini suave">{t('alertasPrecio.sinAlertas')}</span>
      ) : (
        <table className="libro">
          <thead>
            <tr>
              <th>{t('comunes.activo')}</th>
              <th className="num">{t('alertasPrecio.precioMin')}</th>
              <th className="num">{t('alertasPrecio.precioMax')}</th>
              <th>{t('alertasPrecio.activa')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {doc.alertasPrecio.map((a) => {
              const activo = porActivo.get(a.activoId)
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{activo?.simbolo ?? '?'}</td>
                  <td className="num cifra mini">
                    {a.precioMin !== undefined ? formatoMoneda(a.precioMin, activo?.moneda ?? 'MXN') : '—'}
                  </td>
                  <td className="num cifra mini">
                    {a.precioMax !== undefined ? formatoMoneda(a.precioMax, activo?.moneda ?? 'MXN') : '—'}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={a.activa}
                      onChange={(e) => guardarAlertaPrecio({ ...a, activa: e.target.checked })}
                    />
                  </td>
                  <td>
                    <div className="fila-acciones">
                      <button className="btn-icono peligro" onClick={() => eliminarAlertaPrecio(a.id)}>
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
  )
}

/* ---------------- Comisiones (Pro+) ---------------- */

function Comisiones() {
  const { t } = useTranslation()
  const { posiciones, totales } = usePortafolio()
  const base = totales.monedaBase
  const conComision = posiciones.filter((p) => p.comisionesBase > 0).sort((a, b) => b.comisionesBase - a.comisionesBase)
  const pctDelValor = totales.valorTotal > 0 ? (totales.comisiones / totales.valorTotal) * 100 : 0

  return (
    <div>
      <div className="kpi" style={{ marginBottom: 16 }}>
        <span className="etiqueta">{t('analisis.comisionesTotal')}</span>
        <span className="monto">
          <Cifra valor={totales.comisiones} moneda={base} />
        </span>
        <span className="mini suave">{t('analisis.comisionesPctDelValor', { pct: pctDelValor.toFixed(2) })}</span>
      </div>
      {conComision.length > 0 && (
        <table className="libro">
          <thead>
            <tr>
              <th>{t('analisis.comisionesPorActivo')}</th>
              <th className="num">{t('comunes.valor')}</th>
            </tr>
          </thead>
          <tbody>
            {conComision.map((p) => (
              <tr key={p.activo.id}>
                <td style={{ fontWeight: 600 }}>{p.activo.simbolo}</td>
                <td className="num">
                  <Cifra valor={p.comisionesBase} moneda={base} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ---------------- Liquidez (Pro+) ---------------- */

function Liquidez() {
  const { t } = useTranslation()
  const { posiciones, totales } = usePortafolio()
  const umbral = useApp((s) => s.doc.ajustes.umbralLiquidezPct)
  const actualizarAjustes = useApp((s) => s.actualizarAjustes)
  const liquidez = calcularLiquidez(posiciones, umbral)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {liquidez.debajoDelUmbral && (
        <span className="chip ambar" style={{ alignSelf: 'flex-start' }}>
          {t('analisis.liquidezAviso', { pct: formatoPct(liquidez.ratioPct) })}
        </span>
      )}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div className="kpi">
          <span className="etiqueta">{t('analisis.liquidezRatio')}</span>
          <span className="monto cifra">{formatoPct(liquidez.ratioPct)}</span>
        </div>
        <div className="kpi">
          <span className="etiqueta">{t('analisis.liquido')}</span>
          <span className="monto">
            <Cifra valor={liquidez.valorLiquido} moneda={totales.monedaBase} />
          </span>
        </div>
        <div className="kpi">
          <span className="etiqueta">{t('analisis.iliquido')}</span>
          <span className="monto">
            <Cifra valor={liquidez.valorIliquido} moneda={totales.monedaBase} />
          </span>
        </div>
        <div className="campo" style={{ width: 150, marginLeft: 'auto' }}>
          <label>{t('analisis.liquidezUmbral')}</label>
          <input
            type="number"
            min="0"
            max="100"
            value={umbral}
            onChange={(e) => actualizarAjustes({ umbralLiquidezPct: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="barra-h" style={{ height: 10 }}>
        <div
          style={{
            width: `${liquidez.ratioPct}%`,
            background: liquidez.debajoDelUmbral ? 'var(--warning)' : 'var(--gain)',
          }}
        />
      </div>
      <span className="mini suave">{t('analisis.liquidezAyuda')}</span>
    </div>
  )
}

/* ---------------- Benchmarks (Pro+) ---------------- */

const RANGOS = [30, 90, 365] as const

function Benchmarks() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const guardarBenchmark = useApp((s) => s.guardarBenchmark)
  const eliminarBenchmark = useApp((s) => s.eliminarBenchmark)
  const { totales } = usePortafolio()
  const [nombre, setNombre] = useState('')
  const [rend, setRend] = useState('')

  function agregar() {
    if (!nombre.trim() || rend === '' || Number.isNaN(Number(rend))) return
    guardarBenchmark({ id: crypto.randomUUID(), nombre: nombre.trim(), rendimientoPct: Number(rend) })
    setNombre('')
    setRend('')
  }

  const filas = [
    { id: 'portafolio', nombre: t('analisis.miPortafolio'), rendimientoPct: totales.rendimientoPct, propio: true },
    ...doc.benchmarks.map((b) => ({ ...b, propio: false })),
  ]
  const maxAbs = Math.max(1, ...filas.map((f) => Math.abs(f.rendimientoPct)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ minWidth: 180 }}>
          <label>{t('analisis.benchmarkNombre')}</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="S&P 500, IPC, ETF…" />
        </div>
        <div className="campo" style={{ width: 150 }}>
          <label>{t('analisis.benchmarkRend')}</label>
          <input type="number" step="any" value={rend} onChange={(e) => setRend(e.target.value)} placeholder="12.5" />
        </div>
        <button className="btn btn-primario" onClick={agregar} disabled={!nombre.trim() || rend === ''}>
          {t('comunes.agregar')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filas.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mini" style={{ width: 140, fontWeight: f.propio ? 700 : 500 }}>
              {f.nombre}
            </span>
            <div className="barra-h" style={{ flex: 1 }}>
              <div
                style={{
                  width: `${Math.min(100, (Math.abs(f.rendimientoPct) / maxAbs) * 100)}%`,
                  background: f.propio ? 'var(--accent)' : f.rendimientoPct >= 0 ? 'var(--gain)' : 'var(--loss)',
                }}
              />
            </div>
            <span style={{ width: 80, textAlign: 'right' }}>
              <Porcentaje valor={f.rendimientoPct} />
            </span>
            {!f.propio && (
              <button className="btn-icono peligro" onClick={() => eliminarBenchmark(f.id)}>
                <Icono nombre="basura" tam={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <BenchmarksEnVivo />
    </div>
  )
}

/** Extra: cambio % de S&P 500 y BTC traído en vivo (si el opt-in está activo). */
function BenchmarksEnVivo() {
  const { t } = useTranslation()
  const preciosEnVivo = useApp((s) => s.doc.ajustes.preciosEnVivo)
  const [rango, setRango] = useState<(typeof RANGOS)[number]>(30)
  const [datos, setDatos] = useState<Record<string, { sp500?: number; btc?: number }>>({})
  const [cargando, setCargando] = useState(false)
  const miCambio = useCambioPortafolio(rango)

  if (!preciosEnVivo) return null

  async function cargar(dias: (typeof RANGOS)[number]) {
    setRango(dias)
    if (datos[dias]) return
    setCargando(true)
    try {
      const [sp500, btc] = await Promise.all([cambioBenchmark('sp500', dias), cambioBenchmark('btc', dias)])
      setDatos((d) => ({ ...d, [dias]: { sp500, btc } }))
    } catch {
      // silencioso: la sección manual sigue siendo la principal
    } finally {
      setCargando(false)
    }
  }

  const fila = datos[rango]

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="mini suave">{t('analisis.benchmarkTexto')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {RANGOS.map((d) => (
            <button key={d} className={`btn btn-mini ${rango === d ? 'btn-primario' : ''}`} onClick={() => void cargar(d)}>
              {d === 30 ? '1M' : d === 90 ? '3M' : '1A'}
            </button>
          ))}
        </div>
      </div>
      {fila ? (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }} className="mini">
          <span>
            {t('analisis.miPortafolio')}: {miCambio === undefined ? '—' : <Porcentaje valor={miCambio} />}
          </span>
          <span>
            S&P 500: {fila.sp500 === undefined ? '—' : <Porcentaje valor={fila.sp500} />}
          </span>
          <span>
            BTC: {fila.btc === undefined ? '—' : <Porcentaje valor={fila.btc} />}
          </span>
        </div>
      ) : (
        <button className="btn btn-mini" onClick={() => void cargar(rango)} disabled={cargando}>
          {cargando ? t('configuracion.actualizando') : t('configuracion.actualizarAhora')}
        </button>
      )}
    </div>
  )
}

/* ---------------- Metas (Premium) ---------------- */

function Metas() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const eliminarMeta = useApp((s) => s.eliminarMeta)
  const { posiciones, totales } = usePortafolio()
  const base = totales.monedaBase
  const [editando, setEditando] = useState<Meta | 'nueva' | undefined>()

  const progresos = evaluarMetas(posiciones, doc.metas)

  function confirmaEliminar(id: string) {
    if (window.confirm(t('metas.confirmaEliminar'))) eliminarMeta(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button className="btn btn-primario" style={{ alignSelf: 'flex-start' }} onClick={() => setEditando('nueva')}>
        <Icono nombre="mas" tam={14} />
        {t('metas.nueva')}
      </button>

      {doc.metas.length === 0 ? (
        <span className="mini suave">{t('metas.vacioTexto')}</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {progresos.map(({ meta, valorActual, pct, alcanzada }) => (
            <div className="tarjeta" key={meta.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{meta.nombre}</span>
                {alcanzada && <span className="chip verde">{t('metas.alcanzada')}</span>}
                <div className="fila-acciones" style={{ marginLeft: 'auto', opacity: 1 }}>
                  <button className="btn-icono" onClick={() => setEditando(meta)}>
                    <Icono nombre="lapiz" tam={14} />
                  </button>
                  <button className="btn-icono peligro" onClick={() => confirmaEliminar(meta.id)}>
                    <Icono nombre="basura" tam={14} />
                  </button>
                </div>
              </div>
              <div className="barra-h" style={{ height: 10 }}>
                <div style={{ width: `${pct}%`, background: alcanzada ? 'var(--gain)' : 'var(--accent)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="cifra">{formatoMoneda(valorActual, base)}</span>
                <span className="cifra suave">{formatoMoneda(meta.objetivo, base)}</span>
              </div>
              <div className="mini suave">
                {meta.clase ? t(`clases.${meta.clase}`) : t('metas.todoElPortafolio')}
                {meta.fechaLimite && ` · ${formatoFecha(meta.fechaLimite)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <FormMeta existente={editando === 'nueva' ? undefined : editando} alCerrar={() => setEditando(undefined)} />
      )}
    </div>
  )
}

function FormMeta({ existente, alCerrar }: { existente?: Meta; alCerrar: () => void }) {
  const { t } = useTranslation()
  const monedaBase = useApp((s) => s.doc.ajustes.monedaBase)
  const guardarMeta = useApp((s) => s.guardarMeta)
  const [nombre, setNombre] = useState(existente?.nombre ?? '')
  const [objetivo, setObjetivo] = useState(existente ? String(existente.objetivo) : '')
  const [clase, setClase] = useState<ClaseActivo | ''>(existente?.clase ?? '')
  const [fechaLimite, setFechaLimite] = useState(existente?.fechaLimite ?? '')

  const valido = nombre.trim() !== '' && Number(objetivo) > 0 && (fechaLimite === '' || esFechaIsoValida(fechaLimite))

  function guardar() {
    if (!valido) return
    guardarMeta({
      id: existente?.id ?? crypto.randomUUID(),
      nombre: nombre.trim(),
      objetivo: Number(objetivo),
      ...(clase ? { clase } : {}),
      ...(fechaLimite ? { fechaLimite } : {}),
    })
    alCerrar()
  }

  return (
    <Modal
      titulo={existente ? t('metas.editarTitulo') : t('metas.nueva')}
      abierto
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn" onClick={alCerrar}>
            {t('comunes.cancelar')}
          </button>
          <button className="btn btn-primario" onClick={guardar} disabled={!valido}>
            {t('comunes.guardar')}
          </button>
        </>
      }
    >
      <div className="form-rejilla">
        <div className="campo ancho-completo">
          <label>{t('comunes.nombre')}</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </div>
        <div className="campo">
          <label>
            {t('metas.objetivo')} ({monedaBase})
          </label>
          <input type="number" step="any" min="0" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
        </div>
        <div className="campo">
          <label>{t('metas.claseQueCuenta')}</label>
          <select value={clase} onChange={(e) => setClase(e.target.value as ClaseActivo | '')}>
            <option value="">{t('metas.todoElPortafolio')}</option>
            {CLASES.map((c) => (
              <option key={c} value={c}>
                {t(`clases.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>
            {t('metas.fechaLimite')} <span className="suave">({t('comunes.opcional')})</span>
          </label>
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Rebalanceo (Premium) ---------------- */

function Rebalanceo() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const fijarRebalanceo = useApp((s) => s.fijarRebalanceo)
  const { totales } = usePortafolio()
  const base = totales.monedaBase
  const objetivo = doc.rebalanceo?.porClase ?? {}
  const [borrador, setBorrador] = useState<Record<string, string>>(() =>
    Object.fromEntries(CLASES.map((c) => [c, objetivo[c] !== undefined ? String(objetivo[c]) : ''])),
  )

  const suma = CLASES.reduce((s, c) => s + (Number(borrador[c]) || 0), 0)
  const sumaOk = Math.abs(suma - 100) < 0.01

  function guardar() {
    if (!sumaOk) return
    fijarRebalanceo({
      porClase: Object.fromEntries(CLASES.filter((c) => Number(borrador[c]) > 0).map((c) => [c, Number(borrador[c])])),
    })
  }

  const sugerencias = CLASES.map((clase) => {
    const meta = Number(borrador[clase]) || 0
    const actualPct = totales.porClase[clase]?.pct ?? 0
    const actualValor = totales.porClase[clase]?.valor ?? 0
    return { clase, meta, actualPct, delta: (meta / 100) * totales.valorTotal - actualValor }
  })
  const hayDesbalance = sugerencias.some((s) => Math.abs(s.delta) > totales.valorTotal * 0.01)

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        {CLASES.map((c) => (
          <div className="campo" key={c} style={{ width: 110 }}>
            <label>{t(`clases.${c}`)} %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={borrador[c]}
              onChange={(e) => setBorrador((b) => ({ ...b, [c]: e.target.value }))}
            />
          </div>
        ))}
        <button className="btn btn-primario" onClick={guardar} disabled={!sumaOk}>
          {t('comunes.guardar')}
        </button>
        {!sumaOk && suma > 0 && (
          <span className="mini" style={{ color: 'var(--warning)', paddingBottom: 8 }}>
            {t('analisis.rebalanceoSuma')} ({formatoPct(suma)})
          </span>
        )}
      </div>

      {doc.rebalanceo && totales.valorTotal > 0 && (
        <table className="libro">
          <thead>
            <tr>
              <th>{t('comunes.clase')}</th>
              <th className="num">{t('analisis.rebalanceoActual')}</th>
              <th className="num">{t('analisis.rebalanceoObjetivo')}</th>
              <th className="num">{t('analisis.rebalanceoSugerencia')}</th>
            </tr>
          </thead>
          <tbody>
            {sugerencias
              .filter((s) => s.meta > 0 || s.actualPct > 0)
              .map((s) => (
                <tr key={s.clase}>
                  <td>{t(`clases.${s.clase}`)}</td>
                  <td className="num cifra">{formatoPct(s.actualPct)}</td>
                  <td className="num cifra">{formatoPct(s.meta)}</td>
                  <td className="num">
                    {Math.abs(s.delta) <= totales.valorTotal * 0.01 ? (
                      <span className="suave">—</span>
                    ) : (
                      <>
                        <span className="mini suave">
                          {s.delta > 0 ? t('analisis.rebalanceoComprar') : t('analisis.rebalanceoVender')}{' '}
                        </span>
                        <Cifra valor={Math.abs(s.delta)} moneda={base} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {doc.rebalanceo && !hayDesbalance && totales.valorTotal > 0 && (
        <p className="mini positivo" style={{ marginTop: 10 }}>
          {t('analisis.rebalanceoEquilibrado')}
        </p>
      )}
    </div>
  )
}

/* ---------------- Eventos fiscales (todos los planes) ---------------- */

const ETIQUETA_EVENTO: Record<TipoEventoFiscal, `fiscal.tipos.${TipoEventoFiscal}`> = {
  venta_ganancia: 'fiscal.tipos.venta_ganancia',
  venta_perdida: 'fiscal.tipos.venta_perdida',
  dividendo: 'fiscal.tipos.dividendo',
  interes_cobrado: 'fiscal.tipos.interes_cobrado',
  ingreso_especie: 'fiscal.tipos.ingreso_especie',
  interes_devengado_rf: 'fiscal.tipos.interes_devengado_rf',
}

const CHIP_EVENTO: Record<TipoEventoFiscal, string> = {
  venta_ganancia: 'verde',
  venta_perdida: 'rojo',
  dividendo: 'acento',
  interes_cobrado: 'acento',
  ingreso_especie: 'ambar',
  interes_devengado_rf: '',
}

function Fiscal() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const hoy = hoyIso()
  const anioActual = Number(hoy.slice(0, 4))
  const [anio, setAnio] = useState(anioActual)

  const anios = useMemo(() => {
    const set = new Set<number>([anioActual])
    for (const op of doc.operaciones) set.add(Number(op.fecha.slice(0, 4)))
    return [...set].sort((a, b) => b - a)
  }, [doc.operaciones, anioActual])

  const eventos = useMemo(
    () =>
      eventosFiscales(doc.activos, doc.operaciones, anio, hoy, {
        tasaIsrAnual: doc.ajustes.tasaIsrAnual,
        udiActual: doc.ajustes.udiActual,
      }),
    [doc.activos, doc.operaciones, anio, hoy, doc.ajustes.tasaIsrAnual, doc.ajustes.udiActual],
  )
  const resumen = resumirEventos(eventos)
  const base = doc.ajustes.monedaBase

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="campo" style={{ width: 110 }}>
          <label>{t('fiscal.anio')}</label>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <span className="mini suave" style={{ flex: 1 }}>
          {t('fiscal.nota')}
        </span>
        <button className="btn btn-primario" onClick={() => abrirExterno(URL_CONSULTORIA)}>
          <Icono nombre="externo" tam={14} />
          {t('fiscal.consultarAsesor')}
        </button>
      </div>

      {eventos.length === 0 ? (
        <span className="mini suave">{t('fiscal.sinEventos', { anio })}</span>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {resumen.gananciasVentas > 0 && (
              <span className="chip verde">
                {t('fiscal.tipos.venta_ganancia')}: {formatoMoneda(resumen.gananciasVentas, base)}
              </span>
            )}
            {resumen.perdidasVentas < 0 && (
              <span className="chip rojo">
                {t('fiscal.tipos.venta_perdida')}: {formatoMoneda(resumen.perdidasVentas, base)}
              </span>
            )}
            {resumen.dividendos > 0 && (
              <span className="chip acento">
                {t('fiscal.tipos.dividendo')}: {formatoMoneda(resumen.dividendos, base)}
              </span>
            )}
            {resumen.interesesCobrados > 0 && (
              <span className="chip acento">
                {t('fiscal.tipos.interes_cobrado')}: {formatoMoneda(resumen.interesesCobrados, base)}
              </span>
            )}
            {resumen.ingresosEspecie > 0 && (
              <span className="chip ambar">
                {t('fiscal.tipos.ingreso_especie')}: {formatoMoneda(resumen.ingresosEspecie, base)}
              </span>
            )}
            {resumen.interesesDevengadosRf > 0 && (
              <span className="chip">
                {t('fiscal.tipos.interes_devengado_rf')}: {formatoMoneda(resumen.interesesDevengadosRf, base)} ·{' '}
                {t('rentaFija.isrEstimado')} {formatoMoneda(resumen.isrEstimadoRf, base)}
              </span>
            )}
          </div>

          <table className="libro">
            <thead>
              <tr>
                <th>{t('comunes.fecha')}</th>
                <th>{t('comunes.activo')}</th>
                <th>{t('comunes.tipo')}</th>
                <th className="num">{t('comunes.valor')}</th>
                <th className="num">{t('fiscal.resultado')}</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e, i) => (
                <tr key={i}>
                  <td className="cifra mini">{formatoFecha(e.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{e.simbolo}</td>
                  <td>
                    <span className={`chip ${CHIP_EVENTO[e.tipo]}`}>{t(ETIQUETA_EVENTO[e.tipo])}</span>
                  </td>
                  <td className="num">
                    <Cifra valor={e.montoBase} moneda={base} />
                  </td>
                  <td className="num">
                    {e.resultadoBase !== undefined ? (
                      <Cifra valor={e.resultadoBase} moneda={base} signo />
                    ) : e.isrEstimadoBase !== undefined ? (
                      <span className="cifra mini negativo">−{formatoMoneda(e.isrEstimadoBase, base)}</span>
                    ) : (
                      <span className="suave">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
