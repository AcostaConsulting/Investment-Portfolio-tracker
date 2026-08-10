/**
 * Campo numérico que lee lo que la persona quiso escribir.
 *
 * Sustituye a `<input type="number">`, donde quien interpretaba la cifra era
 * Chromium con el locale del SISTEMA mientras la app la mostraba con el idioma
 * de la APP. En 4 de 7 combinaciones medidas no coincidían y el fallo era mudo:
 * `1,5` se guardaba como **15** y `1234,56` como **123456**
 * (AUDITORIA-ROBUSTEZ.md #4).
 *
 * Tres decisiones de diseño:
 * 1. El texto crudo lo conserva quien llama, igual que antes. Este componente
 *    no adivina ni corrige por su cuenta: solo lee, muestra y avisa.
 * 2. **Confirma en pantalla lo que entendió** en cuanto hay un separador. Es la
 *    defensa real contra este bug: el usuario ve `1,5` → `= 1.5` y detecta el
 *    malentendido antes de guardar.
 * 3. El error solo aparece **después de salir del campo**, para no regañar a
 *    medio teclear.
 */

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { lecturasAmbiguas, parsearNumero } from '../engine/numero'
import { formatoCantidad, formatoCantidadSinGrupos } from './formato'

interface Props {
  valor: string
  alCambiar: (texto: string) => void
  /** La validación del formulario ya lo marcó mal. */
  invalido?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
  style?: CSSProperties
  /** Se muestra debajo cuando no hay pista ni error que enseñar. */
  ayuda?: string
}

export function CampoNumero({ valor, alCambiar, invalido, placeholder, autoFocus, className, style, ayuda }: Props) {
  const { t } = useTranslation()
  const [tocado, setTocado] = useState(false)
  const r = parsearNumero(valor)

  // Solo interesa confirmar la lectura cuando hay un separador de por medio:
  // en "100" no hay nada que malinterpretar.
  const tieneSeparador = /[.,\s]/.test(valor)
  const pistaLectura = r.ok && tieneSeparador ? t('numero.interpretado', { valor: formatoCantidad(r.valor) }) : undefined

  let error: string | undefined
  if (!r.ok && tocado && r.motivo !== 'vacio') {
    if (r.motivo === 'ambiguo') {
      const l = lecturasAmbiguas(valor)
      // Sin agrupación: con ella, la opción "1234" se re-renderiza como
      // "1,234" y la pregunta se vuelve absurda. Ver formatoCantidadSinGrupos.
      error = t('numero.ambiguo', {
        decimal: formatoCantidadSinGrupos(l?.decimal ?? 0),
        miles: formatoCantidadSinGrupos(l?.miles ?? 0),
      })
    } else {
      error = t('numero.invalido')
    }
  }

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={[className, invalido || error ? 'invalido' : ''].filter(Boolean).join(' ') || undefined}
        style={style}
        value={valor}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => alCambiar(e.target.value)}
        onBlur={() => setTocado(true)}
      />
      {error ? (
        <span className="ayuda campo-error">{error}</span>
      ) : pistaLectura ? (
        <span className="ayuda campo-lectura">{pistaLectura}</span>
      ) : ayuda ? (
        <span className="ayuda">{ayuda}</span>
      ) : null}
    </>
  )
}
