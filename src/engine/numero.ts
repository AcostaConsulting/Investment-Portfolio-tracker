/**
 * Lectura de números escritos por una persona, con cualquier convención.
 *
 * POR QUÉ EXISTE (AUDITORIA-ROBUSTEZ.md #4): los campos eran
 * `<input type="number">`, y ahí quien interpreta la cifra es Chromium con el
 * locale del SISTEMA, mientras la app la MUESTRA con el idioma de la APP. En 4
 * de 7 combinaciones medidas no coincidían, y el fallo era mudo:
 *
 *     "1,5"      ->  15        (10× de error)
 *     "1234,56"  ->  123456    (100× de error)
 *
 * con `validity.badInput === false`, o sea que ninguna validación lo veía. En
 * una app cuyo entregable es un reporte fiscal, eso es pérdida silenciosa.
 *
 * LA REGLA, en una línea: **se acepta todo lo que sea inequívoco y se rechaza
 * lo que de verdad no se puede saber.** Nunca se adivina.
 *
 * - Coma y punto valen los dos como decimal:  `1,5` = `1.5`
 * - Con los dos separadores presentes, el ÚLTIMO es el decimal y el otro son
 *   miles:  `1.234,56` = `1,234.56` = 1234.56
 * - Un separador repetido son miles:  `1,234,567` = 1234567
 * - El espacio (incluido el duro de `Intl` en francés) son miles
 * - 🔴 UN separador con EXACTAMENTE 3 dígitos detrás y una parte entera que
 *   podría ser un grupo de miles —`1,234`— es **genuinamente ambiguo**: puede
 *   ser 1.234 o 1234. Ahí se devuelve `ambiguo` y quien llama le pide al
 *   usuario que lo escriba sin separador de miles.
 *
 * Módulo puro y sin estado: lo consumen tanto los campos de captura como el
 * import de Excel, para que la MISMA cadena signifique lo mismo entre por
 * teclado o por hoja de cálculo. Antes no era así (`importar.ts` tenía su
 * propia regla), y una fórmula escrita dos veces ya costó cuatro auditorías
 * en este repo (§13.3, §14, §15.6, §16).
 */

export type MotivoRechazo =
  /** No hay nada escrito. */
  | 'vacio'
  /** `1,234`: puede ser 1.234 o 1234 y no hay forma de saberlo. */
  | 'ambiguo'
  /** No es un número: letras, símbolos, grupos de miles mal formados. */
  | 'invalido'

export type ResultadoNumero = { ok: true; valor: number } | { ok: false; motivo: MotivoRechazo }

/** Espacios que las convenciones locales usan como separador de miles. */
const ESPACIOS = /[\s   ]/g

/** Un grupo de miles: 1-3 dígitos al frente, y de ahí en adelante de 3 en 3. */
function milesValidos(entera: string, separador: string): boolean {
  if (!entera.includes(separador)) return /^\d+$/.test(entera)
  const grupos = entera.split(separador)
  const primero = grupos[0]!
  if (!/^\d{1,3}$/.test(primero)) return false
  return grupos.slice(1).every((g) => /^\d{3}$/.test(g))
}

function aNumeroFinito(signo: number, texto: string): ResultadoNumero {
  const n = Number(texto)
  return Number.isFinite(n) ? { ok: true, valor: signo * n } : { ok: false, motivo: 'invalido' }
}

/**
 * Lee un número escrito a mano. Ver la regla completa arriba.
 *
 * No aplica reglas de negocio (mayor que cero, máximo, etc.): eso es de quien
 * llama. Aquí solo se decide qué número quiso escribir la persona, o que no se
 * puede saber.
 */
export function parsearNumero(texto: string): ResultadoNumero {
  const limpio = texto.replace(ESPACIOS, '')
  if (limpio === '') return { ok: false, motivo: 'vacio' }

  let signo = 1
  let cuerpo = limpio
  if (cuerpo.startsWith('+')) cuerpo = cuerpo.slice(1)
  else if (cuerpo.startsWith('-')) {
    signo = -1
    cuerpo = cuerpo.slice(1)
  }

  if (!/^[0-9.,]+$/.test(cuerpo)) return { ok: false, motivo: 'invalido' }
  if (!/[0-9]/.test(cuerpo)) return { ok: false, motivo: 'invalido' }

  const puntos = (cuerpo.match(/\./g) ?? []).length
  const comas = (cuerpo.match(/,/g) ?? []).length

  // --- Sin separadores: entero pelado ---
  if (puntos === 0 && comas === 0) return aNumeroFinito(signo, cuerpo)

  // --- Los dos separadores: el último es el decimal, el otro son miles ---
  if (puntos > 0 && comas > 0) {
    const decimal = cuerpo.lastIndexOf('.') > cuerpo.lastIndexOf(',') ? '.' : ','
    const miles = decimal === '.' ? ',' : '.'
    // El decimal solo puede aparecer una vez.
    if ((cuerpo.match(decimal === '.' ? /\./g : /,/g) ?? []).length !== 1) {
      return { ok: false, motivo: 'invalido' }
    }
    const [entera = '', frac = ''] = cuerpo.split(decimal)
    if (!milesValidos(entera, miles) || !/^\d*$/.test(frac)) return { ok: false, motivo: 'invalido' }
    return aNumeroFinito(signo, `${entera.split(miles).join('')}.${frac}`)
  }

  // --- Un solo tipo de separador ---
  const separador = puntos > 0 ? '.' : ','
  const veces = puntos > 0 ? puntos : comas

  if (veces === 1) {
    const [entera = '', frac = ''] = cuerpo.split(separador)
    if (!/^\d*$/.test(entera) || !/^\d*$/.test(frac)) return { ok: false, motivo: 'invalido' }
    // 🔴 El caso que no se puede saber: `1,234`. Se pide desambiguar.
    // Con parte entera vacía o con un 0 delante (`,234`, `0,234`) la lectura de
    // miles sería un grupo inválido, así que no hay ambigüedad: es decimal.
    if (frac.length === 3 && /^[1-9]\d{0,2}$/.test(entera)) return { ok: false, motivo: 'ambiguo' }
    return aNumeroFinito(signo, `${entera}.${frac}`)
  }

  // Repetido: solo puede ser separador de miles.
  if (!milesValidos(cuerpo, separador)) return { ok: false, motivo: 'invalido' }
  return aNumeroFinito(signo, cuerpo.split(separador).join(''))
}

/**
 * Igual que `parsearNumero` pero devuelve `undefined` en vez del motivo.
 * Para quien solo necesita el valor y ya validó por otro lado.
 */
export function numeroOUndefined(texto: string): number | undefined {
  const r = parsearNumero(texto)
  return r.ok ? r.valor : undefined
}

/**
 * Las dos lecturas posibles de una cadena ambigua, para poder preguntarle al
 * usuario con números concretos en vez de con una regla abstracta:
 * `1,234` → `[1.234, 1234]` → *"¿1.234 o 1234?"*.
 *
 * Devuelve `undefined` si la cadena no es de las ambiguas.
 */
export function lecturasAmbiguas(texto: string): { decimal: number; miles: number } | undefined {
  const r = parsearNumero(texto)
  if (r.ok || r.motivo !== 'ambiguo') return undefined
  const cuerpo = texto.replace(ESPACIOS, '').replace(/^[+-]/, '')
  const separador = cuerpo.includes('.') ? '.' : ','
  const [entera = '', frac = ''] = cuerpo.split(separador)
  return { decimal: Number(`${entera}.${frac}`), miles: Number(`${entera}${frac}`) }
}
