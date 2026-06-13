# Guía: cómo dejar funcionando las licencias (para el dueño)

Hola. Esta guía está en español simple. No necesitas saber programar — solo copiar y pegar comandos. Hazlos **en orden**.

---

## ¿Qué estaba pasando? (en una frase)

Una licencia es como una **firma y su sello**: la app trae un "sello" (llave pública) y solo acepta firmas hechas con la "pluma" (llave privada) que le corresponde. Estaban usando **tres plumas/sellos distintos** que no se correspondían entre sí: uno en la app instalada, otro en el código, y otro en el servidor de Cloudflare. Por eso ninguna licencia activaba.

Ya dejé el código y las llaves alineados a **una sola pareja correcta** (la que está respaldada en tu OneDrive). Solo faltan **3 pasos que dependen de ti**.

---

## Paso 1 — Subir la llave correcta a Cloudflare

Esto le pone a tu servidor la "pluma" correcta para firmar las licencias.

1. Abre **PowerShell** (busca "PowerShell" en el menú de inicio de Windows).
2. Copia y pega estas líneas **una por una** (Enter después de cada una):

```powershell
cd "C:\Users\csp\Proyectos\license-worker"
```
*(Esto entra a la carpeta del servidor de licencias.)*

```powershell
$llave = Get-Content "C:\Users\csp\OneDrive\Acosta F Consulting\secrets\portfolio-tracker\llave-privada.pem" -Raw
$llave | wrangler secret put PRIVATE_KEY_PEM
```
*(Esto sube la llave privada correcta. Si te pregunta algo, confirma. Puede pedirte iniciar sesión en Cloudflare la primera vez.)*

> ⚠️ **Importante:** usa exactamente esa ruta de OneDrive. **NO** uses la conversión con OpenSSL del handoff viejo — esa fue justo parte del error. La llave de OneDrive ya está en el formato correcto.

3. Ahora publica el servidor con el código ya corregido:

```powershell
wrangler deploy
```
*(Esto sube los arreglos que ya hice al código del servidor.)*

✅ Cuando termine sin errores, el Paso 1 está listo.

---

## Paso 2 — Reinstalar la app

El instalador que tienes guardado trae la "llave vieja". Ya compilé uno nuevo con la llave correcta.

1. **Desinstala** la versión actual de "Tracker de Portafolio" (Configuración de Windows → Aplicaciones → Tracker de Portafolio → Desinstalar).
   - 👍 Tus datos NO se borran al desinstalar (viven aparte). Pero si quieres dormir tranquilo, abre la app antes y usa **Configuración → Tus datos → Respaldar a archivo**.
2. Instala el nuevo:
   ```
   C:\Users\csp\Proyectos\Fable portfolio tracker\release\TrackerPortafolio-Setup-0.1.0.exe
   ```
   Dale doble clic y sigue el instalador.

> Si Windows muestra "editor desconocido", haz clic en **Más información → Ejecutar de todas formas**. Es normal (aún no compramos el certificado de firma).

---

## Paso 3 — Probar que ya funciona

1. Genera un código de regalo de prueba. En PowerShell:

```powershell
$body = "permalink=portfoliotrackerlifetime&email=TU-CORREO@gmail.com&full_name=Prueba&sale_id=PRUEBA-001"
Invoke-WebRequest -Uri "https://license-worker.acostafconsulting.workers.dev" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
```
*(Cambia `TU-CORREO@gmail.com` por tu correo. Te llegará la cadena de activación por correo, y también la verás en la respuesta del comando.)*

2. Abre la app → **Configuración → Licencia**.
3. Pega la **cadena completa** (es larga, con dos puntos en medio: `PTRF-LIFE-…….……`) y haz clic en **Activar**.
4. Debe decir **"¡Listo! Plan Lifetime activo."** 🎉

Si funciona, **el problema quedó resuelto**.

---

## Cómo generar licencias de aquí en adelante

Tienes **dos formas**. Las dos ya quedaron arregladas:

### Opción A — Desde el servidor (lo normal, manda el correo solo)
Igual que el Paso 3, cambiando el plan en `permalink`:
- Pro → `portfoliotrackerpro`
- Premium → `portfoliotrackerpremium`
- Lifetime → `portfoliotrackerlifetime`

El servidor genera la licencia y le manda el correo al cliente automáticamente.

### Opción B — A mano desde tu compu (sin servidor, para casos especiales)
En PowerShell, dentro de la carpeta del proyecto:

```powershell
cd "C:\Users\csp\Proyectos\Fable portfolio tracker"
npm run licencia:nueva -- --plan lifetime
```
Te imprime la cadena de activación para que la copies y la mandes tú. Para Premium con vencimiento: `npm run licencia:nueva -- --plan premium --meses 12`.

---

## ⚠️ La regla de oro (para no volver a romperlo)

Hay **una sola pareja de llaves válida**, respaldada aquí:
```
C:\Users\csp\OneDrive\Acosta F Consulting\secrets\portfolio-tracker\
```
- **NUNCA** generes llaves nuevas "para probar". Si cambias la llave, **todas las licencias ya vendidas dejan de funcionar** y hay que recompilar la app y resubir a Cloudflare al mismo tiempo. Eso fue exactamente lo que causó este lío.
- **Respalda esa carpeta de OneDrive** en un lugar seguro (un USB guardado). Si pierdes la llave privada, no podrás generar más licencias para tu app.
- La llave privada es como la combinación de una caja fuerte: **nunca la compartas ni la subas a internet** (excepto a Cloudflare con el comando de arriba, que es seguro).

---

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `wrangler` no se reconoce | Falta instalarlo: `npm install -g wrangler`, luego repite el Paso 1. |
| La app dice "código no válido" | ¿Instalaste el .exe **nuevo** del Paso 2? El viejo siempre dirá inválido. |
| El correo no llega | Revisa spam. La respuesta del comando igual trae la cadena (campo `license_key`). |
| Dudas con cualquier paso | Guarda el mensaje de error completo y pásalo en la siguiente sesión. |

---

*Generado el 12 de junio de 2026. Detalle técnico completo en `HANDOFF-LICENCIAS.md`.*
