// Empaqueta el proceso main y el preload con esbuild.
import { build } from 'esbuild'

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
  minify: false,
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
