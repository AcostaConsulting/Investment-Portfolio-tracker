# Handoff — Diagnóstico y arreglo del sistema de licencias

**Fecha:** 12 de junio de 2026
**Estado:** 🟢 Causa raíz encontrada y corregida en código. Falta que el dueño ejecute 2 pasos manuales (subir llave a Cloudflare + instalar el .exe nuevo). Ver `GUIA-LICENCIAS.md`.

> Este documento **corrige** al `Handoff_Sesion_12Jun2026.md`, cuya hipótesis (formato PKCS8 vs RSA tradicional de la llave) era **equivocada**. Esa pista era un callejón sin salida: la llave importa y firma sin problema. El problema real era otro.

---

## Resumen en una frase

Había **tres llaves distintas** en juego (instalador, código fuente y Cloudflare) que debían ser la misma, **más dos bugs en el Worker**. Por eso ninguna licencia activaba, sin importar cuántas veces se "arreglara" la firma.

---

## Cómo se diagnosticó

Se reprodujeron **los dos lados exactos** (lo que firma el Worker y lo que verifica la app) en scripts de Node con Web Crypto, usando las llaves reales del disco, y se probó firma+verificación de forma aislada. Eso reveló los problemas uno por uno en vez de adivinar. Los scripts eran temporales y ya se borraron.

---

## Los problemas encontrados (en orden de importancia)

### 🔴 Problema 1 — Tres llaves que no son la misma pareja
Una licencia funciona solo si la **llave pública** que verifica (dentro de la app) es la pareja exacta de la **llave privada** que firma (en Cloudflare / script local). Se encontró:

| Dónde | Qué llave tenía | ¿Pareja de cuál privada? |
|---|---|---|
| **Instalador `v0.1.0` (compilado 12-jun 12:38)** | Llave pública "A" (`…CgKCAQEA0rJLIHRA…`) | de una privada vieja, ya perdida en la maraña |
| **Código fuente actual (tras rotar a las 13:08)** | Llave pública "B" (`…CgKCAQEAzhd/VH6v…`) | **de la privada de OneDrive** ✓ |
| **Cloudflare (secret `PRIVATE_KEY_PEM`)** | privada "C" (`secrets/llave-privada-rsa.pem`) | de ninguna de las dos públicas en uso |

**El detalle clave:** el instalador se compiló a las **12:38** y la llave pública se rotó en el commit `0641fd0` a las **13:08** — media hora después. Por eso el `.exe` que se estaba instalando y probando trae una llave **distinta** a la del código y a la de Cloudflare. Tres piezas, tres llaves, cero coincidencias.

### 🔴 Problema 2 — El Worker generaba el código en minúsculas
El Worker producía `PTRF-LIFE-2026-2b8dc795` (hex en minúsculas), pero la app valida con la expresión `[0-9A-F]{8}` que **solo acepta mayúsculas**. La app rechazaba el código como *"malformado"* **antes siquiera de revisar la firma**. Esto solito ya hacía imposible activar, aunque las llaves hubieran coincidido.
**Corregido** en `license-worker/src/index.js`: se agregó `.toUpperCase()` al hex.

### 🟠 Problema 3 — El tier de Premium estaba mal escrito
El Worker mapeaba Premium a `'PREMIUM'`, pero la app espera `'PREM'` (regex `PRO|PREM|LIFE`). Todas las licencias Premium habrían salido malformadas aunque lo demás funcionara.
**Corregido** en el Worker: `'portfoliotrackerpremium' → 'PREM'` y su etiqueta.

---

## Lo que YA se corrigió en esta sesión (en código)

1. **`license-worker/src/index.js`**
   - Hex del código ahora en MAYÚSCULAS (`.toUpperCase()`).
   - Tier de Premium corregido a `PREM` (mapa y etiqueta).
2. **`secrets/llave-privada.pem`** (local, no se sube a git)
   - Reemplazada por la llave de OneDrive (la pareja correcta de la pública embebida). Así el script local `npm run licencia:nueva` ahora firma con la llave correcta.
   - Se eliminó la huérfana `secrets/llave-privada-rsa.pem` que causaba la confusión.
3. **Instalador reconstruido** con `npm run dist` para que la app instalada lleve la llave pública correcta (la de OneDrive). Queda en `release/TrackerPortafolio-Setup-0.1.0.exe`.

**Verificación end-to-end:** se simuló el Worker corregido firmando con la llave de OneDrive y se pasó por la validación real de la app → **Pro, Premium y Lifetime = VÁLIDA ✓** en los tres.

---

## La regla de oro para que no vuelva a pasar

**Una sola pareja de llaves, una sola fuente de verdad: la de OneDrive.**

```
C:\Users\csp\OneDrive\Acosta F Consulting\secrets\portfolio-tracker\
  ├── llave-privada.pem   ← firma (Cloudflare + script local). NUNCA compartir.
  └── llave-publica.pem   ← se embebe en la app (= src/licencias/llave-publica.pem)
```

- La **pública** de ese par ya está en el código (`src/licencias/llave-publica.pem`) y en el instalador recién compilado.
- La **privada** de ese par es la que debe estar en Cloudflare y en `secrets/llave-privada.pem` (ya quedó local).
- **Si algún día rotas la llave, hay que rehacer las TRES cosas a la vez:** re-embeber la pública, recompilar el instalador y re-subir la privada a Cloudflare. Rotar solo una rompe todo (justo lo que pasó).

---

## Lo que falta — acciones del dueño

Detalle paso a paso en `GUIA-LICENCIAS.md`. En resumen:

1. **Subir la llave correcta a Cloudflare** (la de OneDrive, sin convertir nada) y desplegar el Worker.
2. **Desinstalar la app vieja e instalar** `release/TrackerPortafolio-Setup-0.1.0.exe` (el recién compilado).
3. **Probar** con un código de regalo y confirmar que activa.

---

## Notas y pendientes menores

- **Premium nunca vence (hoy).** El Worker pone meta `{}` para todos. El script local sí pone fecha de vencimiento a Premium (`--meses N`). Si quieres que Premium del Worker venza, hay que agregarle la fecha al meta — decisión de producto, no es bug bloqueante.
- **`GUMROAD_WEBHOOK_SECRET`** sigue en "PENDIENTE" en Cloudflare. No bloquea la generación manual de regalos; sí conviene configurarlo antes de conectar el webhook real de Gumroad.
- **El `secrets/` local** nunca se sube a git (está en `.gitignore`). La fuente de verdad sigue siendo OneDrive; respáldala.
- El `Handoff_Sesion_12Jun2026.md` original quedó obsoleto en su sección de diagnóstico — este documento lo reemplaza.
