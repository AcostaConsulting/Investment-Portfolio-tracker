/** Dona SVG sin dependencias para la distribución del portafolio. */

export interface SegmentoDona {
  etiqueta: string
  valor: number
  color: string
}

export function Dona({ segmentos, tam = 168 }: { segmentos: SegmentoDona[]; tam?: number }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0)
  const r = 56
  const circunferencia = 2 * Math.PI * r
  let offset = 0

  return (
    <svg width={tam} height={tam} viewBox="0 0 160 160" role="img">
      <circle cx="80" cy="80" r={r} fill="none" stroke="var(--superficie-2)" strokeWidth="26" />
      {total > 0 &&
        segmentos
          .filter((s) => s.valor > 0)
          .map((s) => {
            const fraccion = s.valor / total
            const largo = fraccion * circunferencia
            const el = (
              <circle
                key={s.etiqueta}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="26"
                strokeDasharray={`${largo} ${circunferencia - largo}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
              />
            )
            offset += largo
            return el
          })}
    </svg>
  )
}
