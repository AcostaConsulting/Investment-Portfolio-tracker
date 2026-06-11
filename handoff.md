# Handoff — Tracker de Portafolio (proyecto Fable 5, desde cero)

**Última sesión:** 11 de junio de 2026
**Estado:** funcional de punta a punta. 88 tests verdes, typecheck verde, instalador NSIS generado.

---

## Qué es esto

Implementación desde cero del Tracker de Portafolio (experimento Fable 5 vs Opus). App de escritorio Windows, 100% local, para inversionistas individuales mexicanos. Todas las features del spec están implementadas (ver matriz abajo).

## Stack y por qué

| Decisión | Razón |
|---|---|
| **Electron 42 + Vite 8 + React 19 + TS 6 estricto** | La máquina del dueño no tiene Rust (Tauri exigía ~2GB de toolchain MSVC). Electron solo necesita Node; electron-builder/updater están muy probados para NSIS + GitHub Releases. |
| **Build manual: esbuild para main/preload, Vite para renderer** | Cero cajas negras; `scripts/dev.mjs` y `scripts/build-electron.mjs` son ~30 líneas cada uno. |
| **Zustand + documento JSON único** | El volumen de datos de un portafolio personal es pequeño. Documento versionado (`version: 1`) con `migrarDocumento()` para evolucionar el esquema sin perder datos. |
| **Sin libs de gráficas ni de fechas** | Dona y barras en SVG propio; fechas como strings ISO + helpers UTC (`src/engine/fechas.ts`). Bundle de app: ~347KB (exceljs va en chunk diferido de ~930KB que solo carga al usar Excel). |
| **Convención: dominio en español** | El dominio ES finanzas mexicanas (CETES, ISR, UDI no se traducen). Infra/técnico en inglés. |

## Arquitectura

- `src/engine/` — **motor puro** (sin DOM/Electron/IO): `portafolio.ts` (costo promedio ponderado, P&L realizado/no realizado, ingresos, multimoneda con doble pista base+nativa, advertencias tipadas), `rentaFija.ts` (valuación por devengo), `fechas.ts`, `dinero.ts`, `tipos.ts`. Aquí vive casi todo el valor; está 100% bajo tests.
- `src/state/` — `documento.ts` (esquema persistido + migración), `store.ts` (Zustand; toda mutación pasa por `mutarDoc` → guardado debounced 600ms vía IPC), `selectores.ts` (usePortafolio memoizado, alertas, cambio % con snapshots).
- `electron/main/` — `almacen.ts` (escritura atómica tmp+rename, 20 respaldos rotativos, recuperación desde respaldo si el JSON está corrupto), `red.ts` (ÚNICO punto con internet; lista blanca: CoinGecko/Yahoo/Frankfurter), `dialogo.ts`, `actualizador.ts`, `index.ts` (ventana + CSP de producción + IPC).
- Seguridad: `contextIsolation+sandbox`, preload mínimo tipado (`src/shared/api.d.ts`), CSP estricta solo en prod, enlaces externos → navegador del sistema.

## Sistemas clave (gotchas incluidos)

### Motor de portafolio
- Operaciones se procesan ordenadas por (fecha, id). Venta usa costo promedio; vender más de la tenencia → advertencia `venta_excede_tenencia` y se procesa solo lo disponible (pensado para imports con huecos).
- En especie (staking/airdrop/recompensa): el valor capturado es a la vez ingreso y base de costo. Ajuste negativo retira proporcional SIN P&L (splits/correcciones).
- Multimoneda: costo histórico usa el `tipoCambio` de cada operación; valuación usa `tiposCambio` vigentes del documento. El motor **nunca inventa un 1:1**: sin TC → advertencia y la posición se muestra a costo (`sinPrecio: true`).

### Renta fija mexicana (`src/engine/rentaFija.ts`)
- CETES/pagaré/SoFIPO: tasa simple base 360, devengo lineal, tope al vencimiento.
- Ahorro (Nu): capitalización diaria base 365, sin vencimiento.
- Bono M: cupones de 182 días sobre nominal; el devengado se reinicia en cada cupón (los cupones cobrados se capturan como operaciones `interes`).
- UDIBONO: interés calculado en UDIs → pesos con `udiActual` (Configuración); principal revaluado por UDI. **Gotcha resuelto:** el interés se multiplica por la UDI vigente, no por el cociente udiActual/udiInicial.
- ISR: % anual SOBRE CAPITAL prorrateado por días/365 (no sobre interés). Default 1.9% configurable global y por instrumento.

### Licencias (offline, RSA-2048)
- Cadena de activación: `PTRF-{PRO|PREM|LIFE}-{YYYY}-{8HEX}.{metaB64url}.{firmaB64url}`. La meta firmada lleva `vence` para Premium mensual — así hay expiración sin servidor.
- Verificación con Web Crypto (funciona igual en renderer y en tests Node, sin mocks). Llave pública embebida vía `?raw`.
- **Sin bloqueo duro:** inválida/vencida → `planEfectivo()` = free + aviso amistoso. Los datos del usuario nunca se bloquean.
- Llaves reales ya generadas: `secrets/llave-privada.pem` (gitignored, **el dueño debe respaldarla**) y `src/licencias/llave-publica.pem` (commiteada).

### i18n
- `es.ts` es la fuente de verdad con `as const`; `Diccionario` ensancha literales a string para las traducciones. `i18next.d.ts` da autocompletado/chequeo de llaves en `t()`.
- Test de paridad (`i18n.test.ts`): mismas llaves, mismos placeholders, y heurística anti-"olvidé traducir" (texto >25 chars idéntico al español falla, salvo puro placeholder).
- Cambio en vivo: `cambiarIdioma()` desde Configuración; el efecto en App sincroniza con `ajustes.idioma`.

### Benchmarks honestos
No hay historia de precios local, así que `SnapshotDiario` (App.tsx) guarda un punto {fecha, valor} por día en `doc.historico` (tope 1100). `useCambioPortafolio(días)` regresa `undefined` si aún no hay historia suficiente y la UI lo dice tal cual — no se inventan comparaciones.

### Excel
- Import (todos los planes): asistente de 3 pasos; `importar.ts` es puro y testeado (mapeo por sinónimos es/en, fechas ISO/dd-mm/serial Excel, tipos buy/sell, números con comas, errores por fila visibles). Símbolos nuevos → activos clase `accion` por default.
- Export (Pro+): `exportar.ts` con exceljs diferido; 3 hojas con formato (encabezado rosa, congelado, autofiltro, numFmt).

### Updater
Opt-in doble: toggle en Configuración + botón "Buscar ahora". `autoDownload=false`; tras descargar se activa `autoInstallOnAppQuit` — se instala cuando EL USUARIO cierra. En dev (`!app.isPackaged`) responde `sin-actualizacion`.

## Matriz de features del spec

| Feature | Estado |
|---|---|
| 8 tipos de operación, 3 clases de activo | ✅ |
| WAC, P&L, asignación, multimoneda real | ✅ + tests |
| CETES/Bono M/UDIBONO/pagaré/SoFIPO/ahorro, ISR, alertas vencimiento | ✅ + tests |
| Licencias RSA offline 4 planes + gating | ✅ + tests |
| i18n 5 idiomas en vivo | ✅ + test de paridad |
| Import Excel (todos) / Export con formato (Pro+) | ✅ + tests del parser |
| Precios en vivo opt-in (CoinGecko/Yahoo/Frankfurter) | ✅ |
| Alertas precio, comisiones, rebalanceo, benchmarks, metas (Premium) | ✅ |
| Tema claro/oscuro/sistema, onboarding, tour | ✅ |
| Respaldo JSON + PIN (AES-GCM/PBKDF2) | ✅ + tests |
| Instalador NSIS + auto-update opt-in GitHub Releases | ✅ (`npm run dist` verificado) |

## Cómo verificar

```
npm run typecheck   # 3 tsconfigs (renderer / tests / electron)
npm test            # 88 tests
npm run dev         # app con HMR
npm run dist        # instalador en release/
```

## Pendientes / siguientes pasos sugeridos

1. **Probar el instalador en limpio** (`release/TrackerPortafolio-Setup-0.1.0.exe`) en una VM o equipo sin Node.
2. **Repo de GitHub**: crear/ajustar remoto, push, y verificar el workflow `release.yml` con un tag `v0.1.0` (el publish necesita que `owner/repo` de `electron-builder.yml` coincidan con el repo real).
3. **Yahoo Finance** a veces exige cookies/crumb en `v7/finance/quote`; si empieza a fallar, cambiar a `v8/finance/chart/{symbol}?range=1d` por símbolo (el host ya está en la lista blanca).
4. **UDI automática**: hoy es manual en Configuración. Banxico SIE requiere token — decidir si se agrega como opt-in con token del usuario.
5. Iconos de alerta de precio: el chequeo de disparo existe en datos (`alertasPrecio` con `disparada`) pero no hay revisión automática al refrescar precios — conectar en `actualizarPrecios()`.
6. Firma de código del .exe (certificado) si Gumroad/SmartScreen lo amerita.

## Convenciones para la siguiente sesión

- Toda llave i18n nueva nace en `es.ts` y se replica en los 4 idiomas (el test de paridad revienta si falta).
- Toda mutación de datos pasa por una acción del store (nunca tocar `doc` directo).
- El motor (`src/engine/`) no importa nada de React/Electron — mantenerlo puro y con tests.
- Commits en español, mensaje descriptivo del porqué.
