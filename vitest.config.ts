import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // `electron/` estuvo fuera de esta lista hasta el 10 ago, así que `almacen.ts`,
    // `red.ts` y `dialogo.ts` no tenían ni una prueba — y ahí vivían tres de los
    // cinco P0 de la auditoría de robustez (AUDITORIA-ROBUSTEZ.md §21.5).
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'electron/**/*.test.ts'],
  },
})
