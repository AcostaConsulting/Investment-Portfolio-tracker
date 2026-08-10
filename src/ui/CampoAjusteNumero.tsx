/**
 * Variante de `CampoNumero` para los campos que están atados directamente a un
 * número del documento (Configuración, tipos de cambio, rebalanceo…) en vez de
 * a un `useState` de texto.
 *
 * Conserva el texto crudo mientras se escribe —si no, borrar el último dígito
 * reescribiría el valor guardado— y **solo propaga cuando la lectura es
 * inequívoca**. Con una cifra ambigua o ilegible no toca el documento: el campo
 * enseña el error y el valor guardado se queda como estaba. Nunca se persiste
 * un número que la app no supo leer con certeza.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { numeroOUndefined, parsearNumero } from '../engine/numero'
import { CampoNumero } from './CampoNumero'

interface Props {
  numero: number | undefined
  alCambiar: (numero: number | undefined) => void
  placeholder?: string
  ayuda?: string
  style?: CSSProperties
  className?: string
}

export function CampoAjusteNumero({ numero, alCambiar, placeholder, ayuda, style, className }: Props) {
  const [texto, setTexto] = useState(() => (numero === undefined ? '' : String(numero)))
  const externoPrevio = useRef(numero)

  // Si el valor cambia por fuera (restaurar un respaldo, otra pantalla), se
  // refleja — pero sin pisar lo que la persona está escribiendo ahora mismo.
  useEffect(() => {
    if (externoPrevio.current === numero) return
    externoPrevio.current = numero
    if (numeroOUndefined(texto) !== numero) setTexto(numero === undefined ? '' : String(numero))
  }, [numero, texto])

  return (
    <CampoNumero
      valor={texto}
      alCambiar={(nuevo) => {
        setTexto(nuevo)
        const r = parsearNumero(nuevo)
        if (r.ok) alCambiar(r.valor)
        else if (r.motivo === 'vacio') alCambiar(undefined)
        // ambiguo / inválido: no se propaga nada. El campo ya lo explica.
      }}
      placeholder={placeholder}
      ayuda={ayuda}
      style={style}
      className={className}
    />
  )
}
