// Modo desarrollo: servidor Vite + Electron apuntando a él.
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { build } from 'esbuild'
import electronPath from 'electron'

const server = await createServer()
await server.listen()
const url = `http://localhost:${server.config.server.port}`
console.log(`Vite listo en ${url}`)

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  sourcemap: 'inline',
}
await build({ ...shared, entryPoints: ['electron/main/index.ts'], outfile: 'out/main/index.cjs', format: 'cjs' })
await build({ ...shared, entryPoints: ['electron/preload/index.ts'], outfile: 'out/preload/index.cjs', format: 'cjs' })

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})
child.on('close', async () => {
  await server.close()
  process.exit(0)
})
