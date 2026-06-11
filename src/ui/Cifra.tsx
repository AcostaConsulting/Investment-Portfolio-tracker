import { formatoMoneda, formatoPct } from './formato'

/** Cifra monetaria en mono tabular; con `signo`, colorea y antepone +/−. */
export function Cifra({
  valor,
  moneda,
  signo = false,
  decimales,
}: {
  valor: number
  moneda: string
  signo?: boolean
  decimales?: number
}) {
  const clase = signo ? (valor > 0 ? 'cifra positivo' : valor < 0 ? 'cifra negativo' : 'cifra suave') : 'cifra'
  const prefijo = signo && valor > 0 ? '+' : ''
  return (
    <span className={clase}>
      {prefijo}
      {formatoMoneda(valor, moneda, decimales)}
    </span>
  )
}

export function Porcentaje({ valor, signo = true }: { valor: number; signo?: boolean }) {
  const clase = signo ? (valor > 0 ? 'cifra positivo' : valor < 0 ? 'cifra negativo' : 'cifra suave') : 'cifra'
  return <span className={clase}>{formatoPct(valor, signo)}</span>
}
