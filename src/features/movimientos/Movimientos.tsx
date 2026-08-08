import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { FormOperacion } from '../captura/FormOperacion'
import { Icono } from '../../ui/Icono'
import { Cifra } from '../../ui/Cifra'
import { formatoCantidad, formatoFecha, formatoMoneda } from '../../ui/formato'
import { compararPorFecha } from '../../engine/fechas'
import { importeBaseOperacion } from '../../engine/costeo'
import type { Operacion, TipoOperacion } from '../../engine/tipos'
import { ImportarExcel } from '../excel/ImportarExcel'
import { exportarExcel } from '../excel/exportar'
import { tieneCapacidad } from '../../licencias/planes'
import { usePortafolio } from '../../state/selectores'

const TIPOS: TipoOperacion[] = ['compra', 'venta', 'dividendo', 'interes', 'staking', 'ajuste', 'airdrop', 'recompensa']

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

export function Movimientos() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const plan = useApp((s) => s.plan)
  const eliminarOperacion = useApp((s) => s.eliminarOperacion)
  const eliminarOperaciones = useApp((s) => s.eliminarOperaciones)
  const portafolio = usePortafolio()

  const [editando, setEditando] = useState<Operacion | 'nueva' | undefined>()
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [filtroActivo, setFiltroActivo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const porActivo = useMemo(() => new Map(doc.activos.map((a) => [a.id, a])), [doc.activos])

  const filtradas = useMemo(() => {
    return [...doc.operaciones]
      .filter((op) => {
        if (filtroActivo && op.activoId !== filtroActivo) return false
        if (filtroTipo && op.tipo !== filtroTipo) return false
        if (desde && op.fecha < desde) return false
        if (hasta && op.fecha > hasta) return false
        return true
      })
      .sort((a, b) => -compararPorFecha(a, b))
  }, [doc.operaciones, filtroActivo, filtroTipo, desde, hasta])

  async function alExportar() {
    setExportando(true)
    try {
      await exportarExcel(doc, portafolio, t)
    } finally {
      setExportando(false)
    }
  }

  function confirmaEliminar(id: string) {
    if (window.confirm(t('movimientos.confirmaEliminar'))) eliminarOperacion(id)
  }

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const sig = new Set(prev)
      if (sig.has(id)) sig.delete(id)
      else sig.add(id)
      return sig
    })
  }

  const idsFiltradas = useMemo(() => filtradas.map((o) => o.id), [filtradas])
  const todasSeleccionadas = idsFiltradas.length > 0 && idsFiltradas.every((id) => seleccion.has(id))

  function alternarTodas() {
    setSeleccion(todasSeleccionadas ? new Set() : new Set(idsFiltradas))
  }

  function confirmaEliminarSeleccion() {
    const ids = [...seleccion]
    if (ids.length === 0) return
    if (window.confirm(t('movimientos.confirmaEliminarVarios', { cantidad: ids.length }))) {
      eliminarOperaciones(ids)
      setSeleccion(new Set())
    }
  }

  const puedeExportar = tieneCapacidad(plan, 'exportarExcel')

  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('movimientos.titulo')}</h1>
        <div className="vista-acciones">
          <button className="btn" onClick={() => setImportando(true)}>
            <Icono nombre="descargar" tam={14} />
            {t('excel.importar')}
          </button>
          {puedeExportar && (
            <button className="btn" onClick={alExportar} disabled={exportando || doc.operaciones.length === 0}>
              <Icono nombre="posiciones" tam={14} />
              {exportando ? t('excel.exportando') : t('excel.exportar')}
            </button>
          )}
          <button className="btn btn-primario" onClick={() => setEditando('nueva')}>
            <Icono nombre="mas" tam={14} />
            {t('movimientos.nuevo')}
          </button>
        </div>
      </div>

      <div className="tarjeta" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 16px' }}>
        <div className="campo" style={{ minWidth: 180 }}>
          <label>{t('comunes.activo')}</label>
          <select value={filtroActivo} onChange={(e) => setFiltroActivo(e.target.value)}>
            <option value="">{t('comunes.todos')}</option>
            {doc.activos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.simbolo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ minWidth: 140 }}>
          <label>{t('comunes.tipo')}</label>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">{t('comunes.todos')}</option>
            {TIPOS.map((tp) => (
              <option key={tp} value={tp}>
                {t(`operaciones.${tp}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>{t('comunes.desde')}</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="campo">
          <label>{t('comunes.hasta')}</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <span className="mini suave" style={{ marginLeft: 'auto', paddingBottom: 8 }}>
          {t('movimientos.totalOperaciones', { cantidad: filtradas.length })}
        </span>
      </div>

      {seleccion.size > 0 && (
        <div
          className="tarjeta"
          style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px' }}
        >
          <span className="mini" style={{ fontWeight: 600 }}>
            {t('movimientos.seleccionados', { cantidad: seleccion.size })}
          </span>
          <button className="btn btn-peligro btn-mini" style={{ marginLeft: 'auto' }} onClick={confirmaEliminarSeleccion}>
            <Icono nombre="basura" tam={14} />
            {t('movimientos.eliminarSeleccionados', { cantidad: seleccion.size })}
          </button>
          <button className="btn btn-fantasma btn-mini" onClick={() => setSeleccion(new Set())}>
            {t('movimientos.cancelarSeleccion')}
          </button>
        </div>
      )}

      <div className="tabla-marco">
        {filtradas.length === 0 ? (
          <div className="vacio">
            <h3>{doc.operaciones.length === 0 ? t('movimientos.vacio') : t('movimientos.vacioFiltros')}</h3>
            {doc.operaciones.length === 0 && (
              <button className="btn btn-primario" onClick={() => setEditando('nueva')}>
                <Icono nombre="mas" tam={14} />
                {t('movimientos.nuevo')}
              </button>
            )}
          </div>
        ) : (
          <table className="libro">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={alternarTodas}
                    title={t('movimientos.seleccionarTodas')}
                  />
                </th>
                <th>{t('comunes.fecha')}</th>
                <th>{t('comunes.activo')}</th>
                <th>{t('comunes.tipo')}</th>
                <th className="num">{t('comunes.cantidad')}</th>
                <th className="num">{t('comunes.precio')}</th>
                <th className="num">{t('movimientos.importeBase', { moneda: doc.ajustes.monedaBase })}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((op) => {
                const activo = porActivo.get(op.activoId)
                const esEfectivo = op.importeEfectivo !== undefined
                const importe = importeBaseOperacion(op)
                return (
                  <tr key={op.id} className={seleccion.has(op.id) ? 'fila-seleccionada' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccion.has(op.id)}
                        onChange={() => alternarSeleccion(op.id)}
                      />
                    </td>
                    <td className="cifra mini">{formatoFecha(op.fecha)}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{activo?.simbolo ?? '?'}</span>
                      {op.nota && (
                        <span className="mini suave" style={{ marginLeft: 8 }}>
                          {op.nota}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`chip ${CHIP_TIPO[op.tipo]}`}>{t(`operaciones.${op.tipo}`)}</span>
                    </td>
                    <td className="num cifra">{esEfectivo ? '—' : formatoCantidad(op.cantidad)}</td>
                    <td className="num cifra">{esEfectivo ? '—' : formatoMoneda(op.precioUnitario, op.moneda)}</td>
                    <td className="num">
                      <Cifra valor={importe} moneda={doc.ajustes.monedaBase} />
                    </td>
                    <td>
                      <div className="fila-acciones">
                        <button className="btn-icono" onClick={() => setEditando(op)} title={t('comunes.editar')}>
                          <Icono nombre="lapiz" tam={14} />
                        </button>
                        <button className="btn-icono peligro" onClick={() => confirmaEliminar(op.id)} title={t('comunes.eliminar')}>
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

      {editando && (
        <FormOperacion
          abierto
          alCerrar={() => setEditando(undefined)}
          existente={editando === 'nueva' ? undefined : editando}
        />
      )}
      {importando && <ImportarExcel abierto alCerrar={() => setImportando(false)} />}
    </div>
  )
}
