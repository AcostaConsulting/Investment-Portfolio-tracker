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

1. **Subir los commits a GitHub** — `git push -u origin main` (ver arriba).
2. **Reinstalar la app en tu equipo** para tener los 4 fixes funcionando:
   - Desinstala "Tracker de Portafolio" (tus datos y tu licencia se conservan).
   - Instala `release\TrackerPortafolio-Setup-0.1.0.exe`.
   - SHA-256: `DB690027BC81C18CCF2D3F09AA6D78F3654BDE179766D7D1FDE9E877FDD5733B`
3. **Licencias — desplegar el Worker** (quedó pendiente de sesiones pasadas): subir la llave correcta a Cloudflare y `wrangler deploy`. Pasos exactos en **`GUIA-LICENCIAS.md`**.
4. **Publicar versión** (cuando quieras vender): subir el `.exe` a un Release de GitHub en `Investment-Portfolio-tracker` y activar GitHub Pages para la carpeta `landing/`.
5. **Backlog de mejoras** (opcional, no urgente): ver **`MEJORAS.md`** — top 3 sugerido: reporte fiscal en PDF, gráfica de evolución, recordatorio + respaldo automático.

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
