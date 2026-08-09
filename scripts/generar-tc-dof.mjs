/**
 * Regenera la serie empaquetada del tipo de cambio FIX de Banco de México.
 *
 * Esta serie es la base del TC con efecto fiscal (handoff §19): el TC
 * aplicable a una operación es el FIX determinado DOS días hábiles bancarios
 * antes, porque Banxico lo determina el día T, se publica en el DOF el T+1 y
 * se usa para solventar obligaciones a partir del T+2 (art. 20 del CFF).
 *
 * Se empaqueta con la app a propósito: son ~35 años de historia en ~80 KB, y
 * así el cálculo fiscal funciona sin red, que es la promesa del producto.
 * Correr antes de cada release para que la cola de la serie llegue al día:
 *
 *     node scripts/generar-tc-dof.mjs
 *
 * Ojo: este script es herramienta de desarrollo, no código de la app. La regla
 * de §7 —"red solo desde red.ts"— aplica a la app empaquetada, no aquí.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const INICIO_FIX = '1991-11-12' // primer dato de la serie de Banxico
const SALIDA = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'datos',
  'tcDofSerie.ts',
)

const hoy = new Date().toISOString().slice(0, 10)
const url =
  `https://api.frankfurter.dev/v2/rates` +
  `?from=${INICIO_FIX}&to=${hoy}&base=USD&quotes=MXN&providers=BANXICO`

console.log(`Descargando FIX USD/MXN ${INICIO_FIX} → ${hoy}…`)
const respuesta = await fetch(url)
if (!respuesta.ok) {
  console.error(`Falló la descarga: HTTP ${respuesta.status}`)
  process.exit(1)
}
const filas = await respuesta.json()

if (!Array.isArray(filas) || filas.length === 0) {
  console.error('La respuesta no trae registros. ¿Cambió la API?')
  process.exit(1)
}

// Guardas: si la serie llega vacía, corta o con huecos absurdos, es mejor
// fallar aquí que empaquetar datos malos y descubrirlo en el reporte fiscal.
const ordenadas = [...filas].sort((a, b) => (a.date < b.date ? -1 : 1))
if (ordenadas[0].date !== INICIO_FIX) {
  console.error(`El primer dato es ${ordenadas[0].date}, se esperaba ${INICIO_FIX}.`)
  process.exit(1)
}
for (const f of ordenadas) {
  if (!(f.rate > 0)) {
    console.error(`Tasa inválida en ${f.date}: ${f.rate}`)
    process.exit(1)
  }
}

// Formato compacto: la primera fecha, y de ahí en adelante cuántos días
// naturales pasaron hasta el siguiente día hábil. Los huecos SON el calendario
// bancario mexicano (fines de semana y feriados), así que no hay que
// mantener una lista de feriados aparte.
const offsets = []
let previa = null
for (const f of ordenadas) {
  const d = Date.parse(`${f.date}T00:00:00Z`)
  offsets.push(previa === null ? 0 : Math.round((d - previa) / 86_400_000))
  previa = d
}

const saltoMaximo = Math.max(...offsets)
if (saltoMaximo > 15) {
  console.error(`Hueco sospechoso de ${saltoMaximo} días en la serie. Revisar antes de empaquetar.`)
  process.exit(1)
}

const contenido = `/**
 * Serie del tipo de cambio FIX (pesos por dólar) de Banco de México.
 *
 * GENERADO — no editar a mano. Correr \`node scripts/generar-tc-dof.mjs\`.
 *
 * Formato compacto: \`desde\` es la primera fecha y \`offsets[i]\` son los días
 * naturales entre el dato i−1 y el i. Esos huecos son el calendario bancario
 * mexicano, así que la lista de feriados no se mantiene por separado.
 *
 * Fuente: Banco de México (serie FIX), vía la API de Frankfurter.
 * Generado el ${hoy} · ${ordenadas.length} días hábiles · ${ordenadas[0].date} → ${ordenadas[ordenadas.length - 1].date}
 */

import type { SerieFix } from '../engine/tcDof'

export const SERIE_FIX: SerieFix = {
  desde: '${ordenadas[0].date}',
  hasta: '${ordenadas[ordenadas.length - 1].date}',
  offsets: [${offsets.join(',')}],
  tasas: [${ordenadas.map((f) => f.rate).join(',')}],
}
`

writeFileSync(SALIDA, contenido, 'utf8')
const kb = (Buffer.byteLength(contenido) / 1024).toFixed(1)
console.log(`Escrito ${SALIDA}`)
console.log(`  ${ordenadas.length} días hábiles · ${ordenadas[0].date} → ${ordenadas[ordenadas.length - 1].date} · ${kb} KB`)
console.log(`  salto máximo entre días hábiles: ${saltoMaximo} días naturales`)
