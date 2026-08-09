/**
 * Tipo de cambio con efecto FISCAL: el que publica el DOF.
 *
 * No es el mismo que se usa para valuar el portafolio hoy. Son dos pistas
 * distintas y sólo ésta tiene consecuencia fiscal (handoff §19.5):
 *
 * - `op.tipoCambio` — histórico, guardado en cada operación. Entra al costo,
 *   a la ganancia realizada y a los dividendos. **Es el que gobierna este
 *   módulo.**
 * - `doc.tiposCambio` — vigente, para saber cuánto vale el portafolio hoy.
 *   No lo toca este módulo.
 *
 * LA REGLA, y por qué no es el FIX del día de la operación:
 *
 *   día T     Banxico DETERMINA el FIX (a partir de las 12:00)
 *   día T+1   se PUBLICA en el Diario Oficial de la Federación
 *   día T+2   es el TC APLICABLE para solventar obligaciones
 *
 * Y el art. 20 del CFF manda usar el TC publicado en el DOF el día hábil
 * bancario inmediato anterior a la fecha de pago. Encadenado: el TC aplicable
 * a una operación del día D es el FIX determinado DOS días hábiles antes.
 *
 * Tomar el FIX del mismo día —lo natural— se equivoca por dos días hábiles.
 * Sobre las operaciones reales del dueño eso movía el TC 0.44% en promedio y
 * hasta 1.27% en el peor caso (§19.3).
 *
 * El calendario de días hábiles bancarios de México NO se mantiene aparte:
 * son las fechas que la propia serie del FIX contiene. Un feriado bancario
 * simplemente no tiene dato, y eso es exactamente lo que hace falta saber.
 *
 * Módulo puro: recibe la serie como dato, no la importa. Así se puede probar
 * con calendarios de juguete y el que llama decide cómo cargarla.
 */

/** Serie del FIX en formato compacto. La genera `scripts/generar-tc-dof.mjs`. */
export interface SerieFix {
  /** Primera fecha con dato, ISO `YYYY-MM-DD`. */
  desde: string
  /** Última fecha con dato. Más allá de aquí el módulo no responde. */
  hasta: string
  /** Días naturales entre el dato i−1 y el i. El primero es 0. */
  offsets: number[]
  /** Pesos por dólar, alineado con `offsets`. */
  tasas: number[]
}

/** Serie ya expandida e indexada, lista para consultar muchas veces. */
export interface TablaFix {
  fechas: string[]
  tasas: number[]
  hasta: string
}

export interface TcDof {
  /** Fecha de determinación del FIX que resultó aplicable. */
  fechaFix: string
  /** Pesos por dólar. */
  tasa: number
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/
const MS_POR_DIA = 86_400_000

/** Expande los offsets a fechas ISO. Las ausencias son el calendario bancario. */
export function fechasHabiles(serie: SerieFix): string[] {
  const fechas: string[] = []
  let t = Date.parse(`${serie.desde}T00:00:00Z`)
  for (let i = 0; i < serie.offsets.length; i++) {
    // El primer offset es 0: arranca en `desde` y de ahí suma.
    if (i > 0) t += serie.offsets[i]! * MS_POR_DIA
    fechas.push(new Date(t).toISOString().slice(0, 10))
  }
  return fechas
}

/** Prepara la serie para consultarla. Hacerlo una vez, no por operación. */
export function crearTablaFix(serie: SerieFix): TablaFix {
  return { fechas: fechasHabiles(serie), tasas: serie.tasas, hasta: serie.hasta }
}

/**
 * TC del DOF aplicable a una operación con fecha `fechaOperacion`: el FIX
 * determinado dos días hábiles bancarios antes.
 *
 * Devuelve `undefined` —nunca un número inventado— cuando no se puede saber:
 * - fecha mal formada,
 * - antes de que la serie empiece (no hay dos hábiles previos),
 * - después del último dato empaquetado. Ahí ya no sabemos qué días fueron
 *   hábiles, así que contar hacia atrás sería una suposición. Quien llama
 *   decide si pide el dato a la red; este módulo no adivina.
 */
export function tcDofAplicable(tabla: TablaFix, fechaOperacion: string): TcDof | undefined {
  if (!FECHA_ISO.test(fechaOperacion)) return undefined
  if (fechaOperacion > tabla.hasta) return undefined

  // Índice del último día hábil ESTRICTAMENTE anterior a la operación.
  // Búsqueda binaria: la serie tiene ~8,700 entradas y esto corre por
  // operación al recalcular.
  let lo = 0
  let hi = tabla.fechas.length - 1
  let ultimoAnterior = -1
  while (lo <= hi) {
    const medio = (lo + hi) >> 1
    if (tabla.fechas[medio]! < fechaOperacion) {
      ultimoAnterior = medio
      lo = medio + 1
    } else {
      hi = medio - 1
    }
  }

  // Hacen falta DOS hábiles previos: el de la publicación en el DOF y, un día
  // hábil antes, el de su determinación.
  const indiceFix = ultimoAnterior - 1
  if (indiceFix < 0) return undefined

  return { fechaFix: tabla.fechas[indiceFix]!, tasa: tabla.tasas[indiceFix]! }
}
