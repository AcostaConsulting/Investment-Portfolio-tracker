/**
 * Modo desarrollo con `userData` AISLADO.
 *
 * `npm run dev` escribe sobre el `datos.json` real y dispara la rotación de
 * respaldos, que sólo guarda 10 y borra el más viejo: probar con la app así
 * ya estuvo a punto de costar el portafolio del dueño (handoff §14).
 *
 * Esto lanza Electron con `--user-data-dir` apuntando a una carpeta
 * desechable, así que la app crea ahí su propio `datos.json` y su propia
 * carpeta `respaldos\` y `%APPDATA%\Tracker de Portafolio\` no se toca.
 * Verificado con sha256 de los 12 archivos antes y después: 12/12 idénticos
 * (§16.7). Sustituye al procedimiento de copiar-y-restaurar de §14: es más
 * corto y no puede perder datos.
 *
 *     npm run dev:aislado                       # arranca vacío
 *     npm run dev:aislado -- --datos ruta.json  # siembra un documento
 *
 * El `--datos` se COPIA a la carpeta desechable; el original nunca se abre
 * para escritura, así que se puede apuntar sin miedo a un respaldo real.
 */

import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { build } from 'esbuild'
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electronPath from 'electron'

const args = process.argv.slice(2)
const iDatos = args.indexOf('--datos')
const semilla = iDatos >= 0 ? args[iDatos + 1] : undefined

const userDataDir = mkdtempSync(path.join(tmpdir(), 'patrimo-aislado-'))
mkdirSync(userDataDir, { recursive: true })
if (semilla) {
  copyFileSync(semilla, path.join(userDataDir, 'datos.json'))
  console.log(`Sembrado con ${semilla}`)
}

const server = await createServer()
await server.listen()
const url = `http://localhost:${server.config.server.port}`
console.log(`Vite listo en ${url}`)
console.log(`userData AISLADO: ${userDataDir}`)
console.log('(%APPDATA%\\Tracker de Portafolio no se toca)')

const compartido = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  sourcemap: 'inline',
}
await build({ ...compartido, entryPoints: ['electron/main/index.ts'], outfile: 'out/main/index.cjs', format: 'cjs' })
await build({ ...compartido, entryPoints: ['electron/preload/index.ts'], outfile: 'out/preload/index.cjs', format: 'cjs' })

const hijo = spawn(electronPath, ['.', `--user-data-dir=${userDataDir}`], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})
hijo.on('close', async () => {
  await server.close()
  process.exit(0)
})
