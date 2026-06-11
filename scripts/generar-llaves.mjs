// Genera el par de llaves RSA-2048 para firmar licencias.
//
// Uso:  npm run licencia:llaves
//
// - secrets/llave-privada.pem  → SECRETA. Nunca la compartas ni la subas a git.
// - src/licencias/llave-publica.pem → se embebe en la app (esta sí es pública).
//
// Solo se corre UNA vez. Si regeneras las llaves, las licencias ya vendidas
// dejan de validar: respalda secrets/ en un lugar seguro.

import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const RUTA_PRIVADA = 'secrets/llave-privada.pem'
const RUTA_PUBLICA = 'src/licencias/llave-publica.pem'

if (existsSync(RUTA_PRIVADA) && !process.argv.includes('--forzar')) {
  console.error(`⛔ Ya existe ${RUTA_PRIVADA}.`)
  console.error('   Si de verdad quieres regenerar (las licencias vendidas dejarán de funcionar):')
  console.error('   npm run licencia:llaves -- --forzar')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

mkdirSync('secrets', { recursive: true })
writeFileSync(RUTA_PRIVADA, privateKey, { mode: 0o600 })
writeFileSync(RUTA_PUBLICA, publicKey)

console.log('✅ Llaves generadas:')
console.log(`   privada → ${RUTA_PRIVADA}  (¡respáldala y nunca la compartas!)`)
console.log(`   pública → ${RUTA_PUBLICA}  (embebida en la app)`)
