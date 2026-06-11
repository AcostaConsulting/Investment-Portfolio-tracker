import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { usePortafolio } from '../../state/selectores'
import { PuertaPremium } from '../../ui/PuertaPremium'
import { Modal } from '../../ui/Modal'
import { Icono } from '../../ui/Icono'
import { formatoFecha, formatoMoneda } from '../../ui/formato'
import { esFechaIsoValida } from '../../engine/fechas'
import type { Meta } from '../../state/documento'

export function Metas() {
  const { t } = useTranslation()
  return (
    <div className="vista">
      <PuertaPremium capacidad="metas">
        <ListaMetas />
      </PuertaPremium>
      {/* La cabecera vive dentro para que el candado ocupe la vista completa */}
    </div>
  )
}

function ListaMetas() {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const eliminarMeta = useApp((s) => s.eliminarMeta)
  const { posiciones, totales } = usePortafolio()
  const base = totales.monedaBase
  const [editando, setEditando] = useState<Meta | 'nueva' | undefined>()

  function valorMeta(meta: Meta): number {
    if (meta.activos.length === 0) return totales.valorTotal
    return posiciones
      .filter((p) => meta.activos.includes(p.activo.id))
      .reduce((s, p) => s + (p.valorBase ?? 0), 0)
  }

  function confirmaEliminar(id: string) {
    if (window.confirm(t('metas.confirmaEliminar'))) eliminarMeta(id)
  }

  return (
    <>
      <div className="vista-cabecera">
        <h1>{t('metas.titulo')}</h1>
        <button className="btn btn-primario" onClick={() => setEditando('nueva')}>
          <Icono nombre="mas" tam={14} />
          {t('metas.nueva')}
        </button>
      </div>

      {doc.metas.length === 0 ? (
        <div className="tarjeta vacio">
          <h3>{t('metas.vacioTitulo')}</h3>
          <p>{t('metas.vacioTexto')}</p>
          <button className="btn btn-primario" onClick={() => setEditando('nueva')}>
            <Icono nombre="mas" tam={14} />
            {t('metas.nueva')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {doc.metas.map((meta) => {
            const valor = valorMeta(meta)
            const pct = meta.objetivo > 0 ? Math.min(100, (valor / meta.objetivo) * 100) : 0
            const alcanzada = valor >= meta.objetivo
            return (
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
                  <div style={{ width: `${pct}%`, background: alcanzada ? 'var(--verde)' : 'var(--acento)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="cifra">{formatoMoneda(valor, base)}</span>
                  <span className="cifra suave">{formatoMoneda(meta.objetivo, base)}</span>
                </div>
                <div className="mini suave">
                  {meta.activos.length === 0 ? t('metas.todoElPortafolio') : `${meta.activos.length} activos`}
                  {meta.fechaLimite && ` · ${formatoFecha(meta.fechaLimite)}`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && (
        <FormMeta existente={editando === 'nueva' ? undefined : editando} alCerrar={() => setEditando(undefined)} />
      )}
    </>
  )
}

function FormMeta({ existente, alCerrar }: { existente?: Meta; alCerrar: () => void }) {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const guardarMeta = useApp((s) => s.guardarMeta)
  const [nombre, setNombre] = useState(existente?.nombre ?? '')
  const [objetivo, setObjetivo] = useState(existente ? String(existente.objetivo) : '')
  const [fechaLimite, setFechaLimite] = useState(existente?.fechaLimite ?? '')
  const [seleccion, setSeleccion] = useState<string[]>(existente?.activos ?? [])

  const valido = nombre.trim() !== '' && Number(objetivo) > 0 && (fechaLimite === '' || esFechaIsoValida(fechaLimite))

  function guardar() {
    if (!valido) return
    guardarMeta({
      id: existente?.id ?? crypto.randomUUID(),
      nombre: nombre.trim(),
      objetivo: Number(objetivo),
      ...(fechaLimite ? { fechaLimite } : {}),
      activos: seleccion,
    })
    alCerrar()
  }

  function alternar(id: string) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
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
            {t('metas.objetivo')} ({doc.ajustes.monedaBase})
          </label>
          <input type="number" step="any" min="0" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
        </div>
        <div className="campo">
          <label>
            {t('metas.fechaLimite')} <span className="suave">({t('comunes.opcional')})</span>
          </label>
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
        </div>
        <div className="campo ancho-completo">
          <label>{t('metas.activosQueCuentan')}</label>
          <span className="ayuda">{t('metas.todoElPortafolio')}: {t('comunes.todos').toLowerCase()} ↓</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {doc.activos.map((a) => (
              <label key={a.id} className="chip" style={{ cursor: 'pointer', gap: 6 }}>
                <input type="checkbox" checked={seleccion.includes(a.id)} onChange={() => alternar(a.id)} style={{ width: 13, height: 13 }} />
                {a.simbolo}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
