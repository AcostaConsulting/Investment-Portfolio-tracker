/** Dona + leyenda para una dimensión de diversificación. */

import { useTranslation } from 'react-i18next'
import { Dona } from './Dona'
import { formatoMoneda, formatoPct } from './formato'
import { useApp } from '../state/store'
import { SIN_CLASIFICAR, type Rebanada, type VistaDiversificacion } from '../engine/diversificacion'
import { SECTORES_ACCION, GEOGRAFIAS } from '../engine/tipos'

export type Dimension = 'clase' | 'sector' | 'geografia' | 'etiqueta'
export const DIMENSIONES: Dimension[] = ['clase', 'sector', 'geografia', 'etiqueta']

const PALETA = [
  'var(--accent)',
  'var(--c-accion)',
  'var(--c-cripto)',
  'var(--gain)',
  'var(--warning)',
  'var(--loss)',
  'var(--text-muted)',
  'var(--accent-dim)',
]

const COLOR_CLASE: Record<string, string> = {
  accion: 'var(--c-accion)',
  cripto: 'var(--c-cripto)',
  renta_fija: 'var(--c-renta-fija)',
}

export function GraficaDiversificacion({
  vista,
  dimension,
  tam = 140,
}: {
  vista: VistaDiversificacion
  dimension: Dimension
  tam?: number
}) {
  const { t } = useTranslation()
  const etiquetas = useApp((s) => s.doc.etiquetas)
  const monedaBase = useApp((s) => s.doc.ajustes.monedaBase)

  const rebanadas: Rebanada[] =
    dimension === 'clase'
      ? vista.porClase
      : dimension === 'sector'
        ? vista.porSector
        : dimension === 'geografia'
          ? vista.porGeografia
          : vista.porEtiqueta

  function nombreDe(r: Rebanada): string {
    if (r.clave === SIN_CLASIFICAR) return t('clasificacion.sinClasificar')
    if (dimension === 'clase') return t(`clases.${r.clave as 'accion' | 'cripto' | 'renta_fija'}`)
    if (dimension === 'sector' && (SECTORES_ACCION as readonly string[]).includes(r.clave))
      return t(`clasificacion.sectores.${r.clave as (typeof SECTORES_ACCION)[number]}`)
    if (dimension === 'geografia' && (GEOGRAFIAS as readonly string[]).includes(r.clave))
      return t(`clasificacion.geografias.${r.clave as (typeof GEOGRAFIAS)[number]}`)
    return r.nombre ?? r.clave
  }

  function colorDe(r: Rebanada, i: number): string {
    if (dimension === 'clase') return COLOR_CLASE[r.clave] ?? PALETA[i % PALETA.length]!
    if (dimension === 'etiqueta') return etiquetas.find((e) => e.id === r.clave)?.color ?? PALETA[i % PALETA.length]!
    return PALETA[i % PALETA.length]!
  }

  if (rebanadas.length === 0) {
    return <p className="mini suave" style={{ margin: 0 }}>{t('clasificacion.sinDatosDimension')}</p>
  }

  const segmentos = rebanadas.map((r, i) => ({ etiqueta: nombreDe(r), valor: r.valor, color: colorDe(r, i) }))

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
      <Dona segmentos={segmentos} tam={tam} />
      <div className="dona-leyenda">
        {rebanadas.slice(0, 7).map((r, i) => (
          <div key={r.clave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="punto" style={{ background: colorDe(r, i) }} />
            <span className="mini">{nombreDe(r)}</span>
            <span className="mini cifra suave" title={formatoMoneda(r.valor, monedaBase)}>
              {formatoPct(r.pct)}
            </span>
          </div>
        ))}
        {rebanadas.length > 7 && <span className="mini suave">+{rebanadas.length - 7}</span>}
      </div>
    </div>
  )
}
