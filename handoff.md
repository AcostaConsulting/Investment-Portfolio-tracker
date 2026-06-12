# Handoff — Tracker de Portafolio (proyecto Fable 5)

**Última sesión:** Sesión 2 — 11 de junio de 2026
**Estado:** funcional de punta a punta. **116 tests verdes**, typecheck verde (3 tsconfigs), `npm run dev` arranca limpio. Todo el spec de S2 implementado.

---

## Qué es esto

Implementación desde cero del Tracker de Portafolio (experimento Fable 5 vs Opus). App de escritorio Windows, 100% local, para inversionistas individuales mexicanos. La Sesión 1 construyó el producto base; la Sesión 2 agregó el rediseño visual slate/índigo, comparador de planes, clasificación de activos, pantalla Análisis completa, consultoría, TC histórico, onboarding nuevo, Ayuda y landing.

## Stack (decidido en S1, intacto)

Electron 42 + Vite 8 + React 19 + TS 6 estricto · Zustand + documento JSON único versionado · esbuild para main/preload · Vitest · exceljs (chunk diferido) · gráficas SVG propias · sin libs de fechas/router.

## ⚠️ Desviaciones deliberadas del prompt S2 (leer antes de "corregir")

El prompt S2 listaba convenciones del proyecto **Opus**, no de este. Bajo su propia regla de oro ("los requerimientos describen QUÉ, no CÓMO; la arquitectura es tuya"), se mantuvo lo propio:

| Prompt S2 decía | Este repo hace | Por qué |
|---|---|---|
| Tailwind + `tailwind.config` | CSS variables puras en `global.css` | No hay Tailwind aquí; los tokens del spec se adoptaron tal cual como custom properties. Cero colores hardcodeados en componentes. |
| Clase `.dark` en `<html>` | `data-tema='claro'\|'oscuro'` | Sistema equivalente ya probado; `darkMode: 'class'` era un detalle de Tailwind. |
| Campos snake_case, `TipoOperacion` capitalizado | camelCase y minúsculas | Convención real del repo desde S1; cambiarla rompía todo sin valor. |
| `UpgradeLock` | `PuertaPremium` | Mismo rol; ahora abre el modal de planes. |
| `src/screens/` | `src/features/` | Estructura existente. |
| `--border` oscuro `#1E293B` | `#2c3a4f` | El valor del spec es idéntico a `--surface-1`: separadores invisibles. Juicio de diseño documentado en `global.css`. |
| Tour para por Configuración | termina en Análisis | El spec S2 define las 5 paradas con Análisis al final. |

## Mapa de la Sesión 2 (commits en orden)

1. **S2-B1** — Sistema visual v2 "Libro de Acero": tokens slate/índigo claro+oscuro, oscuro default, anti-flash (`temaInicial.ts` + `localStorage('pt-tema')` + fondo en `index.html`), toggle sol/luna en sidebar. Firma de diseño justificada en comentario de `global.css` (regla doble contable + mono tabular + Fraunces).
2. **S2-B2** — `engine/planes.ts` (capacidades + matriz 13×4), `ModalPlanes` (precios USD/MXN via `config/planes.ts: USD_MXN_DISPLAY`, compra Gumroad), `lib/externo.ts` (allowlist HTTPS: gumroad/odoo/github — único camino para links). Gating S2: alertas/comisiones/liquidez/benchmarks → Pro; etiquetas ilimitadas → Premium.
3. **S2-B3** — `Activo` += `sector` (GICS para acciones, lista cripto literal), `geografia`, `etiquetaIds`, `liquido`. `engine/etiquetas.ts`, `engine/diversificacion.ts`. Etiquetas como entidades con color; gestión en Configuración; `GraficaDiversificacion` con tabs en Resumen.
4. **S2-B4** — Motores `alertas.ts` (piso/techo), `liquidez.ts`, `metas.ts` (por clase o total), `fiscal.ts` (eventos descriptivos del año: WAC por venta, dividendos/intereses, especie, devengo RF vía `valuarRentaFija` en dos fechas). Análisis reescrito: 8 secciones colapsables. Migraciones en `migrarDocumento`: alertas viejas `{condicion,precio}` → `{precioMin,precioMax}`; metas pierden `activos[]`. La vista Metas desapareció (vive en Análisis); el nav ganó Ayuda.
5. **S2-B5** — `engine/consultoria.ts` ($149 USD, desc. 0/10/15/20%) + `TarjetaConsultoria` en Dashboard.
6. **S2-B6** — TC histórico Frankfurter (`v1/{fecha}`) en FormOperacion: checkbox "Usar TC de esta fecha" (on en altas, off al editar), cancelación de fetches, fallback manual.
7. **S2-B7** — Onboarding 3 pasos (bienvenida / idioma+moneda / **ejemplo o blanco**); `state/ejemplo.ts` genera AAPL+KO+BTC+CETES con fechas relativas a hoy. Tour con spotlight real (box-shadow 9999px) + tooltip junto al nav.
8. **S2-B8** — Ayuda: inicio rápido, 5 videos placeholder ("Próximamente"), FAQ de 8 para inversionistas MX, reporte que copia versión+mensaje al portapapeles + botón contacto.
9. **S2-B9** — `landing/index.html` (estática, autocontenida, hero-tesis "Tu portafolio no necesita la nube", tabla libro mayor decorativa, 4 planes con Gumroad, SHA `[SHA256-PENDING]`, FAQ 5) + `PRIVACY.md` + `TERMINOS.md`.

## Gotchas de esta sesión

- **PowerShell 5.1 + git commit**: mensajes con comillas dobles dentro de here-strings rompen el paso de argumentos. Mensajes de commit sin comillas dobles.
- **`Diccionario`**: `es.ts` usa `as const`; el tipo exportado ensancha literales a `string` para que las traducciones tipen. Toda llave nueva nace en `es` y el test de paridad (`i18n.test.ts`) revienta si falta en algún idioma o si difieren los placeholders.
- **El sweep de tokens** se hizo con reemplazo ordenado (`--acento-tinta` antes que `--tinta`, etc.). Si agregas tokens, cuida los prefijos.
- **`useAlertasDisparadas`** evalúa al vuelo contra `doc.precios` (no hay estado "disparada" persistido); el badge del Dashboard y los chips de Análisis salen de ahí.
- **Eventos fiscales**: el devengo RF del año NO duplica los cupones cobrados — esos entran como `interes_cobrado` desde operaciones; el devengado es la estimación lineal del instrumento y se reporta aparte.
- **Frankfurter** no cubre todas las monedas (solo las del BCE). Si `tipoCambioHistorico` regresa undefined, la UI pide captura manual — comportamiento esperado, no bug.

## Cómo verificar

```
npm run typecheck   # 0 errores (renderer / tests / electron)
npm test            # 116 tests
npm run dev         # sin errores de consola; tema oscuro default
npm run dist        # instalador NSIS (verificado en S1)
```

## Backlog para la siguiente sesión

1. **Probar el instalador en limpio** y publicar el primer tag `v0.1.0` (workflow listo; `owner/repo` de `electron-builder.yml` debe coincidir con el repo real). Actualizar el SHA-256 de la landing post-build.
2. **Activar GitHub Pages** para `landing/` (o moverla a rama `gh-pages`).
3. **Yahoo v7/quote** puede empezar a exigir cookies/crumb: plan B documentado es `v8/finance/chart/{symbol}` (host ya en allowlist).
4. **UDI automática** (Banxico SIE requiere token; hoy es manual en Configuración).
5. Exportar Excel aún no incluye sector/geografía/etiquetas como columnas — agregar si el dueño lo pide.
6. Considerar notificaciones nativas (Notification API) cuando una alerta de precio se dispara con la app abierta.
7. Firma de código del .exe si SmartScreen molesta a los primeros usuarios.

## Reglas de la casa (no cambiar sin razón)

- `src/engine/` puro: sin DOM, sin Electron, sin React, sin red. Tests para todo motor nuevo (mínimo 3, casos borde).
- Toda mutación por acciones del store → `mutarDoc` → guardado debounced.
- Red SOLO desde `electron/main/red.ts` (allowlist); links externos SOLO por `lib/externo.ts` (allowlist).
- Licencias RSA intactas: cadena `PTRF-*.meta.firma`, llave pública embebida, sin bloqueo duro.
- `sandbox: true`, `contextIsolation: true`, `webSecurity: true` — no bajar.
- Commits en español explicando el porqué.
