import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { useCambioPortafolio, usePortafolio } from '../../state/selectores'
import { PuertaPremium } from '../../ui/PuertaPremium'
import { Cifra, Porcentaje } from '../../ui/Cifra'
import { cambioBenchmark } from '../../servicios/precios'
import { formatoPct } from '../../ui/formato'
import type { ClaseActivo } from '../../engine/tipos'

type Pestana = 'benchmarks' | 'comisiones' | 'rebalanceo'
const RANGOS = [30, 90, 365] as const
const CLASES: ClaseActivo[] = ['accion', 'cripto', 'renta_fija']

export function Analisis() {
  const { t } = useTranslation()
  const [pestana, setPestana] = useState<Pestana>('benchmarks')

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('analisis.titulo')}</h1>
        <div className="vista-acciones">
          {(['benchmarks', 'comisiones', 'rebalanceo'] as Pestana[]).map((p) => (
            <button key={p} className={`btn ${pestana === p ? 'btn-primario' : ''}`} onClick={() => setPestana(p)}>
              {t(`analisis.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {pestana === 'benchmarks' && (
        <PuertaPremium capacidad="benchmarks">
          <Benchmarks />
        </PuertaPremium>
      )}
      {pestana === 'comisiones' && (
        <PuertaPremium capacidad="analisisComisiones">
          <Comisiones />
        </PuertaPremium>
      )}
      {pestana === 'rebalanceo' && (
        <PuertaPremium capacidad="rebalanceo">
          <Rebalanceo />
        </PuertaPremium>
      )}
    </div>
  )
}

function Benchmarks() {
  const { t } = useTranslation()
  const preciosEnVivo = useApp((s) => s.doc.ajustes.preciosEnVivo)
  const [rango, setRango] = useState<(typeof RANGOS)[number]>(30)
  const [datos, setDatos] = useState<Record<string, { sp500?: number; btc?: number }>>({})
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const miCambio = useCambioPortafolio(rango)

  async function cargar(dias: (typeof RANGOS)[number]) {
    setRango(dias)
    if (datos[dias] || !preciosEnVivo) return
    setCargando(true)
    setError('')
    try {
      const [sp500, btc] = await Promise.all([cambioBenchmark('sp500', dias), cambioBenchmark('btc', dias)])
      setDatos((d) => ({ ...d, [dias]: { sp500, btc } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errores.redFallo'))
    } finally {
      setCargando(false)
    }
  }

  const fila = datos[rango]

  return (
    <div className="tarjeta">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span className="etiqueta">{t('analisis.benchmarkTexto')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {RANGOS.map((d) => (
            <button key={d} className={`btn btn-mini ${rango === d ? 'btn-primario' : ''}`} onClick={() => void cargar(d)}>
              {d === 30 ? '1M' : d === 90 ? '3M' : '1A'}
            </button>
          ))}
        </div>
      </div>

      {!preciosEnVivo ? (
        <p className="suave">{t('analisis.necesitaPrecios')}</p>
      ) : (
        <table className="libro">
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>{t('analisis.miPortafolio')}</td>
              <td className="num">{miCambio === undefined ? <span className="suave">—</span> : <Porcentaje valor={miCambio} />}</td>
            </tr>
            <tr>
              <td>S&P 500</td>
              <td className="num">
                {cargando ? <span className="suave">…</span> : fila?.sp500 === undefined ? <span className="suave">—</span> : <Porcentaje valor={fila.sp500} />}
              </td>
            </tr>
            <tr>
              <td>Bitcoin</td>
              <td className="num">
                {cargando ? <span className="suave">…</span> : fila?.btc === undefined ? <span className="suave">—</span> : <Porcentaje valor={fila.btc} />}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {error && <p className="mini" style={{ color: 'var(--rojo)' }}>{error}</p>}
      {preciosEnVivo && !fila && !cargando && (
        <button className="btn" style={{ marginTop: 10 }} onClick={() => void cargar(rango)}>
          {t('configuracion.actualizarAhora')}
        </button>
      )}
    </div>
  )
}

function Comisiones() {
  const { t } = useTranslation()
  const { posiciones, totales } = usePortafolio()
  const base = totales.monedaBase
  const conComision = posiciones.filter((p) => p.comisionesBase > 0).sort((a, b) => b.comisionesBase - a.comisionesBase)
  const pctDelCosto = totales.costoTotal > 0 ? (totales.comisiones / totales.costoTotal) * 100 : 0

  return (
    <div className="tarjeta">
      <div className="kpi" style={{ marginBottom: 16 }}>
        <span className="etiqueta">{t('analisis.comisionesTotal')}</span>
        <span className="monto">
          <Cifra valor={totales.comisiones} moneda={base} />
        </span>
        <span className="mini suave">{t('analisis.comisionesPctDelCosto', { pct: pctDelCosto.toFixed(2) })}</span>
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
      porClase: Object.fromEntries(
        CLASES.filter((c) => Number(borrador[c]) > 0).map((c) => [c, Number(borrador[c])]),
      ),
    })
  }

  const sugerencias = CLASES.map((clase) => {
    const meta = Number(borrador[clase]) || 0
    const actualPct = totales.porClase[clase]?.pct ?? 0
    const actualValor = totales.porClase[clase]?.valor ?? 0
    const metaValor = (meta / 100) * totales.valorTotal
    return { clase, meta, actualPct, delta: metaValor - actualValor }
  })
  const hayDesbalance = sugerencias.some((s) => Math.abs(s.delta) > totales.valorTotal * 0.01)

  return (
    <div className="tarjeta">
      <div className="etiqueta" style={{ marginBottom: 12 }}>
        {t('analisis.rebalanceoObjetivo')}
      </div>
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
          <span className="mini" style={{ color: 'var(--ambar)', paddingBottom: 8 }}>
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
