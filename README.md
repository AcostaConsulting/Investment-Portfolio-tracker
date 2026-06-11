# Tracker de Portafolio

App de escritorio para Windows que lleva el control de tus inversiones: acciones, cripto y **renta fija mexicana** (CETES, UDIBONOS, pagarés, SoFIPOs, Nu). **100% local**: sin cuenta, sin nube, sin telemetría.

---

## Guía del dueño (no necesitas ser programador)

Todo se hace con comandos cortos desde la carpeta del proyecto. Solo necesitas tener instalado [Node.js](https://nodejs.org) (versión 20 o más nueva).

### Primera vez

```
npm install
npm run licencia:llaves
```

El segundo comando crea tus llaves de firma de licencias:
- `secrets/llave-privada.pem` → **SECRETA**. Respáldala en un lugar seguro (USB, gestor de contraseñas). Si la pierdes, no podrás emitir licencias nuevas compatibles; si la filtras, cualquiera podrá generar licencias.
- `src/licencias/llave-publica.pem` → va dentro de la app, no es secreta.

### Vender una licencia

Cuando alguien compre en Gumroad, genera su código:

```
npm run licencia:nueva -- --plan pro
npm run licencia:nueva -- --plan lifetime
npm run licencia:nueva -- --plan premium --meses 12
```

Copia la **cadena de activación completa** que imprime y envíasela al cliente. Él la pega en la app: Configuración → Licencia.

### Probar la app en tu máquina

```
npm run dev
```

### Crear el instalador

```
npm run dist
```

El instalador queda en `release/TrackerPortafolio-Setup-X.Y.Z.exe`.

### Publicar una versión nueva (con auto-update)

```
npm version patch
git push --follow-tags
```

GitHub Actions construye el instalador y lo publica en Releases automáticamente. Los usuarios que activaron "buscar actualizaciones" la verán en la app; **ellos deciden** cuándo descargar e instalar (nunca se reinicia sola).

> Si cambias de repositorio, actualiza `owner`/`repo` en `electron-builder.yml`.

### ¿Dónde viven los datos de los usuarios?

En su equipo: `%APPDATA%/tracker-portafolio/datos.json`, con respaldos rotativos en `respaldos/`. La app jamás los manda a ningún lado.

---

## Para desarrollo

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en modo desarrollo con recarga en vivo |
| `npm test` | Corre los 88 tests (motor de cálculo, licencias, Excel, respaldos, i18n) |
| `npm run typecheck` | Verificación de tipos de los 3 contextos (renderer, tests, electron) |
| `npm run build` | typecheck + tests + bundle de renderer y main |
| `npm run dist` | Todo lo anterior + instalador NSIS en `release/` |

### Arquitectura en 30 segundos

```
src/engine/       Motor de cálculo PURO (sin DOM/Electron) — el corazón, 100% testeado
src/licencias/    Validación RSA offline + gating por plan
src/state/        Documento persistido + store Zustand + selectores
src/features/     Vistas: resumen, posiciones, movimientos, rentafija, analisis, metas, configuracion
src/i18n/         es (fuente de verdad), en, fr, zh, ja
src/servicios/    Precios en vivo (opt-in) y respaldos cifrados
electron/main/    Ventana, almacén atómico, proxy de red con lista blanca, updater
electron/preload/ Puente mínimo tipado (contextBridge)
scripts/          Herramientas del dueño y build
```

Decisiones clave en [handoff.md](handoff.md).
