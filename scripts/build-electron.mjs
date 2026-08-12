// Empaqueta el proceso main y el preload con esbuild.
import { build } from 'esbuild'

/**
 * Canal de distribución, congelado en tiempo de build.
 *
 * Es la SEGUNDA capa de la guarda del actualizador (handoff §30). La primera es
 * `process.windowsStore` en runtime; ésta no depende de que Electron detecte
 * bien el empaquetado. Un fallo aquí significa un paquete de Microsoft Store
 * que se auto-actualiza por fuera de la Store: motivo de rechazo en
 * certificación y, si llegara a instalar, rompería la firma del paquete. No es
 * sitio para depender de una sola señal.
 *
 * `npm run dist:store` exporta PATRIMO_CANAL=store; el build normal no lo pone.
 */
const CANAL = process.env.PATRIMO_CANAL === 'store' ? 'store' : 'github'
console.log(`  canal de distribución: ${CANAL}`)

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
  minify: false,
  define: { 'process.env.PATRIMO_CANAL': JSON.stringify(CANAL) },
}

await build({
  ...shared,
  entryPoints: ['electron/main/index.ts'],
  outfile: 'out/main/index.cjs',
  format: 'cjs',
})

await build({
  ...shared,
  entryPoints: ['electron/preload/index.ts'],
  outfile: 'out/preload/index.cjs',
  format: 'cjs',
})

console.log('✓ main + preload compilados')
