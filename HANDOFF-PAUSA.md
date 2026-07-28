# Handoff de pausa — Tracker de Portafolio

**Fecha:** 15 de junio de 2026
**Estado:** 🟢 Estable. Todo compila, 123 pruebas verdes, instalador recién generado. Proyecto en pausa.

> Este documento resume **dónde nos quedamos** para retomar sin perder contexto. Los detalles técnicos profundos están en los otros handoffs (ver "Mapa de documentos" abajo).

---

## ⚠️ Lo primero al retomar (no se te olvide)

Hay **5 commits hechos localmente que NO están en GitHub todavía.** El trabajo está guardado en tu compu pero no respaldado en la nube. Para subirlo:

```powershell
cd "C:\Users\csp\Proyectos\Fable portfolio tracker"
git push -u origin main
```

Los 5 commits sin subir son:
```
0c021d8  docs(landing): actualizar SHA-256 al instalador recien compilado
9012257  fix(consultoria): precio base a MXN $800 (antes USD $149)
e78561d  fix(metas): modal atrapado/recortado dentro de la seccion colapsable
e1499b9  fix(landing): apuntar enlaces al repo nuevo Investment-Portfolio-tracker
2be7762  fix(precios): fallback a Yahoo v8/chart cuando v7/quote da Unauthorized
```

- **Rama:** `main` · **Remoto:** `origin → github.com/AcostaConsulting/Investment-Portfolio-tracker`
- Árbol de trabajo **limpio** (no hay cambios sin commitear).

---

## Qué se hizo en esta sesión (4 bugs + SHA)

| # | Bug | Arreglo | Commit |
|---|-----|---------|--------|
| 1 | Yahoo "Unauthorized": no actualizaba precios de acciones | Fallback automático a `v8/finance/chart` cuando el endpoint viejo falla. + 6 pruebas nuevas | `2be7762` |
| 2 | Enlaces apuntaban al repo viejo | Landing → repo nuevo `Investment-Portfolio-tracker` | `e1499b9` |
| 3 | Menú de Metas Financieras se mostraba recortado/atrapado | El modal ahora se monta a nivel de página (portal); ya no lo recorta la sección | `e78561d` |
| 4 | Precio de consultoría en USD $149 | Cambiado a **MXN $800**; descuentos por plan intactos (800/720/680/640) | `9012257` |
| — | SHA-256 de la landing desactualizado | Actualizado al instalador nuevo | `0c021d8` |

**Verificación:** `npm run typecheck` 0 errores · `npm test` 123 verdes · `npm run dist` build OK con los 4 fixes confirmados dentro del instalador.

---

## Pendientes para cuando retomes (en orden)

1. ~~Subir los commits a GitHub~~ - HECHO (push del 27 jun en adelante).
2. ~~Reinstalar la app~~ - HECHO. Version vigente:
   - Instalador: `TrackerPortafolio-Setup-0.2.2.exe`
   - SHA-256: `9F48F6976FDC7B02173DCDA52AC174744380D376EB6FB5CAF60C0777237F05DA`
   - (v0.2.1 quedo superada: `9A3F82B0F79C60352BA2B3FA2BE72D8755DACB50FBC2C1F6E1D80BA4D4F0F049` - traia el auto-update roto, ver punto 4.)
3. ~~Licencias - desplegar el Worker~~ - HECHO. Flujo end-to-end verificado: compra en Gumroad -> webhook -> Worker genera licencia -> Resend envia email -> usuario activa en la app.
4. ~~Publicar version~~ - HECHO (28 jul 2026). v0.2.2 publicada en GitHub Releases (SHA arriba, verificado contra el binario real: `latest.yml` responde 200 y coincide en sha512/size).
   - v0.2.1 tenia dos bugs de auto-update, ya arreglados en v0.2.2: (a) `autoInstallOnAppQuit` se encendia despues de descargar y nunca instalaba nada; (b) el workflow de release creaba DOS releases para el mismo tag y GitHub servia el que no traia el instalador (404). Detalle tecnico completo en `handoff.md` §2.1-2.3.
   - 🔲 Falta reemplazar el `.exe` en los 3 productos de Gumroad (Pro, Premium, Lifetime) - ahi sigue el de v0.2.1.
   - 🔲 Falta avisar a los promotores con licencia-regalo que reinstalen a mano una vez: su copia trae el auto-update roto y no se actualiza sola ni a v0.2.2.
   - Nota: la carpeta `landing/` se elimino del repo el 27 jul 2026. La landing oficial vive unicamente en Odoo (`acostaconsulting.odoo.com/patrimo-portfolio-tracker`). No se usa GitHub Pages.
5. Backlog de mejoras (opcional, no urgente): ver **`MEJORAS.md`**.
---

## Mapa de documentos (dónde está cada cosa)

| Archivo | Para qué |
|---------|----------|
| `HANDOFF-PAUSA.md` | **Este documento** — dónde nos quedamos. |
| `handoff.md` | Estado técnico general del proyecto (arquitectura, stack, convenciones). |
| `HANDOFF-LICENCIAS.md` | Diagnóstico técnico del sistema de licencias (las 3 llaves, los bugs del Worker). |
| `GUIA-LICENCIAS.md` | Pasos para ti (no programador) para dejar las licencias funcionando. |
| `MANUAL.md` | Manual de usuario de la app. |
| `MEJORAS.md` | Lista priorizada de mejoras futuras. |
| `README.md` | Cómo correr/compilar el proyecto. |

---

## Recordatorios clave (para no romper nada)

- **Licencias:** la pareja de llaves válida es la de `OneDrive\Acosta F Consulting\secrets\portfolio-tracker\`. Nunca generes llaves nuevas "para probar" — rompe todas las licencias vendidas. (Detalle en `HANDOFF-LICENCIAS.md`.)
- **Comandos útiles:**
  - `npm run dev` — abrir la app en modo desarrollo.
  - `npm test` — correr las pruebas.
  - `npm run dist` — generar el instalador (`release\`).
  - `npm run licencia:nueva -- --plan lifetime` — generar una licencia a mano.

---

*Proyecto en pausa el 15 de junio de 2026. Todo guardado localmente; falta `git push`.*
