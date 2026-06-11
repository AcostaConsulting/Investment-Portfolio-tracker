// Genera una licencia firmada para un cliente.
//
// Uso:
//   npm run licencia:nueva -- --plan pro
//   npm run licencia:nueva -- --plan lifetime
//   npm run licencia:nueva -- --plan premium             (vence en 1 mes)
//   npm run licencia:nueva -- --plan premium --meses 12  (vence en 12 meses)
//
// Imprime la cadena de activación completa: cópiala y envíasela al cliente.
// El cliente la pega en la app en Configuración → Licencia.

import { randomBytes, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const TIERS = { pro: 'PRO', premium: 'PREM', lifetime: 'LIFE' }

function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const plan = (argumento('plan') ?? '').toLowerCase()
if (!TIERS[plan]) {
  console.error('⛔ Indica el plan: --plan pro | premium | lifetime')
  process.exit(1)
}

let llavePrivada
try {
  llavePrivada = readFileSync('secrets/llave-privada.pem', 'utf8')
} catch {
  console.error('⛔ No encuentro secrets/llave-privada.pem.')
  console.error('   Primero corre: npm run licencia:llaves')
  process.exit(1)
}

// Código legible que va en el recibo del cliente.
const anio = new Date().getFullYear()
const hex = randomBytes(4).toString('hex').toUpperCase()
const codigo = `PTRF-${TIERS[plan]}-${anio}-${hex}`

// Metadata firmada: Premium lleva fecha de vencimiento.
const meta = {}
if (plan === 'premium') {
  const venceArg = argumento('vence')
  if (venceArg) {
    meta.vence = venceArg
  } else {
    const meses = Number(argumento('meses') ?? 1)
    const fecha = new Date()
    fecha.setMonth(fecha.getMonth() + meses)
    meta.vence = fecha.toISOString().slice(0, 10)
  }
}

const aB64Url = (texto) => Buffer.from(texto).toString('base64url')
const metaB64 = aB64Url(JSON.stringify(meta))
const firma = sign('sha256', Buffer.from(`${codigo}.${metaB64}`), llavePrivada).toString('base64url')
const activacion = `${codigo}.${metaB64}.${firma}`

console.log('✅ Licencia generada\n')
console.log(`   Plan:    ${plan}${meta.vence ? `  (vence ${meta.vence})` : ''}`)
console.log(`   Código:  ${codigo}\n`)
console.log('   Cadena de activación (envía TODO esto al cliente):\n')
console.log(activacion)
