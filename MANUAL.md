# Manual de usuario — Tracker de Portafolio

Bienvenido. Esta guía está escrita en español claro, sin tecnicismos. Si sabes leer un estado de cuenta, sabes usar esta app.

> **La promesa de la app en una línea:** tú capturas tus operaciones (lo que compraste y vendiste) y la app calcula todo lo demás. Y tus datos **nunca salen de tu computadora**.

---

## Índice

1. [Qué hace esta app](#1-qué-hace-esta-app)
2. [Instalación](#2-instalación)
3. [La primera vez que abres la app](#3-la-primera-vez-que-abres-la-app)
4. [Tres conceptos que conviene entender](#4-tres-conceptos-que-conviene-entender)
5. [Las pantallas, una por una](#5-las-pantallas-una-por-una)
6. [Cómo registrar cada tipo de operación](#6-cómo-registrar-cada-tipo-de-operación)
7. [Renta fija mexicana (CETES, Bonos, etc.)](#7-renta-fija-mexicana)
8. [Precios en vivo](#8-precios-en-vivo)
9. [Eventos fiscales](#9-eventos-fiscales)
10. [Respaldos: ¡lo más importante!](#10-respaldos-lo-más-importante)
11. [Tu licencia](#11-tu-licencia)
12. [Preguntas frecuentes](#12-preguntas-frecuentes)

---

## 1. Qué hace esta app

Es un cuaderno inteligente para tus inversiones personales. Manejas tres tipos de cosas:

- **Acciones** (Apple, América Móvil, cualquier bolsa)
- **Cripto** (Bitcoin, Ethereum…)
- **Renta fija mexicana** (CETES, Bonos M, UDIBONOS, pagarés, SOFIPOs, cuentas tipo Nu)

Tú anotas cuándo compraste, cuánto y a qué precio. La app te dice en todo momento cuánto vale tu portafolio, cuánto has ganado o perdido, cómo está repartido tu dinero y qué eventos fiscales tuviste en el año.

---

## 2. Instalación

1. Descarga el archivo `TrackerPortafolio-Setup.exe`.
2. Dale doble clic.
3. Si Windows muestra un aviso de "editor desconocido", haz clic en **Más información → Ejecutar de todas formas** (es seguro; solo significa que aún no compramos el certificado de firma).
4. Sigue el instalador. Puedes elegir la carpeta de instalación.
5. Se crea un acceso directo. ¡Listo!

No necesitas internet para instalar ni para usar la app en su día a día.

---

## 3. La primera vez que abres la app

Verás un asistente de bienvenida de 3 pasos:

1. **Bienvenida** — una pantalla que explica de qué se trata.
2. **Configuración inicial** — eliges tu **idioma** y tu **moneda base** (lo normal en México es **MXN**, pesos).
3. **¿Cómo quieres empezar?**
   - **Cargar datos de ejemplo:** mete un portafolio ficticio (Apple, Coca-Cola, Bitcoin y un CETES) para que veas cómo se ve todo lleno. Lo puedes borrar después.
   - **Empezar en blanco:** arrancas con la app vacía, lista para tus datos reales.

> 💡 **Consejo:** la primera vez, elige "datos de ejemplo" para explorar sin miedo. Cuando entiendas la app, borras el ejemplo y metes lo tuyo.

Después aparece un **tour guiado** que te señala las pantallas principales. Lo puedes saltar y volver a verlo cuando quieras desde Configuración.

---

## 4. Tres conceptos que conviene entender

Solo tres. Con esto, todo lo demás se explica solo.

### Moneda base
Es la moneda en la que quieres ver **el total** de tu portafolio. Normalmente pesos (MXN). Aunque tengas acciones en dólares, la app las convierte a tu moneda base para darte el gran total.

### Tipo de cambio
Cuando compras algo en otra moneda (por ejemplo, acciones de Apple en dólares), la app necesita saber **a cuántos pesos equivalía 1 dólar el día de tu compra**. Eso es el tipo de cambio.
- Si activas la casilla **"Usar TC de esta fecha"**, la app lo busca sola por internet.
- Si no, lo escribes tú.

### Costo promedio ponderado
Suena complicado, es simple. Si compraste 10 acciones a $100 y luego 10 a $200, tu costo promedio es $150 cada una. La app lo calcula automáticamente cada vez que compras. Sirve para saber tu ganancia real cuando vendes.

---

## 5. Las pantallas, una por una

En la barra izquierda tienes el menú. Esto hace cada sección:

| Pantalla | Para qué sirve |
|---|---|
| **Resumen** | El tablero principal. Valor total, ganancia, cómo está repartido tu dinero y avisos. Lo primero que ves. |
| **Posiciones** | Cada activo que tienes ahora: cuánto, a qué costo, cuánto vale hoy y tu ganancia o pérdida. |
| **Movimientos** | El historial de todo lo que has capturado. Aquí registras compras, ventas, dividendos, etc. y los filtras. |
| **Renta fija** | Tus CETES, bonos y pagarés con el interés que llevan generado día a día. |
| **Análisis** | Lo avanzado: diversificación, alertas de precio, comisiones, liquidez, comparativas, metas y tus eventos fiscales del año. |
| **Ayuda** | Guía rápida, videos (próximamente) y preguntas frecuentes dentro de la app. |
| **Configuración** | Idioma, tema claro/oscuro, moneda base, tipos de cambio, respaldos y tu licencia. |

Abajo a la izquierda hay un botón de **sol/luna** para cambiar entre tema claro y oscuro al instante.

---

## 6. Cómo registrar cada tipo de operación

Ve a **Movimientos → Nueva operación**. Eliges el tipo y llenas los datos. Aquí están todos:

| Tipo | Cuándo se usa | Truco |
|---|---|---|
| **Compra** | Compraste un activo. | La comisión que cobra tu casa de bolsa se suma a tu costo. |
| **Venta** | Vendiste. | La app calcula sola tu ganancia o pérdida contra el costo promedio. |
| **Dividendo** | Te pagaron dividendos en efectivo. | Cantidad = número de acciones, Precio = dividendo por acción. |
| **Interés** | Cobraste intereses (de un bono, pagaré, etc.). | Para un monto directo: Cantidad = el importe, Precio = 1. |
| **Staking** | Recompensa de cripto por "stakear". | Aumenta tu cantidad y cuenta como ingreso. |
| **Ajuste** | Corregir cantidades (un split de acciones, por ejemplo). | Positivo agrega, negativo quita, sin afectar tu ganancia. |
| **Airdrop** | Te regalaron cripto. | Si fue gratis, pon precio 0. |
| **Recompensa** | Otras recompensas en especie. | Igual que staking. |

> 💡 **¿Capturas un dividendo o interés en efectivo y no sabes qué poner en "cantidad" y "precio"?**
> Pon el importe total en **Cantidad** y **1** en Precio. Ejemplo: cobraste $500 de intereses → Cantidad: 500, Precio: 1.

### ¿No existe el activo todavía?
En el formulario de operación, junto al selector de activo hay un botón **+** para crear uno nuevo al vuelo (le pones símbolo, nombre, clase, moneda y, opcionalmente, sector, geografía y etiquetas).

---

## 7. Renta fija mexicana

Este es el corazón de la app y lo que ninguna otra hace bien. Para registrar un CETES, un bono o un pagaré:

1. Ve a **Renta fija → Nuevo instrumento** (o crea un activo de clase "Renta fija").
2. Elige el tipo: **CETES, Bono M, UDIBONO, Pagaré, SOFIPO o Ahorro**.
3. Llena:
   - **Tasa anual** (la que te dieron, por ejemplo 9.80%)
   - **Fecha de inicio** y **fecha de vencimiento**
   - Para UDIBONOS: el valor de la UDI al comprar
4. Luego registra una **compra** por el monto que invertiste (con precio 1 si capturas por monto).

A partir de ahí, la app te muestra **todos los días**:
- Cuánto interés llevas generado (devengado)
- El ISR estimado que te retendrán
- Cuánto recibirás neto al vencimiento
- Cuántos días faltan, con alerta cuando se acerca el vencimiento

### Ejemplo concreto: un CETES
Compraste $50,000 en CETES a 182 días con tasa de 9.80%.
- Creas el instrumento "CETES-182", tasa 9.80%, fechas de inicio y vencimiento.
- Registras una compra: Cantidad 50000, Precio 1, Moneda MXN.
- La app va mostrando cómo crecen tus intereses cada día y cuánto ISR estimado llevas.

> ⚠️ **Importante (y tú lo sabes mejor que nadie):** el ISR que muestra la app es una **estimación** (1.9% anual sobre el capital, configurable). No es tu cálculo fiscal definitivo. Es para darte una idea, no para sustituir tu trabajo profesional.

---

## 8. Precios en vivo

Por defecto, la app **no se conecta a internet**. Si quieres que los precios de tus acciones y cripto se actualicen solos:

1. Ve a **Configuración → Red**.
2. Activa **"Precios en vivo"** (necesita plan Pro o superior).
3. Usa el botón **"Actualizar precios ahora"** cuando quieras.

La app consulta CoinGecko (cripto), Yahoo Finance (acciones) y Frankfurter (tipos de cambio). **Nunca manda tus montos ni datos personales** — solo pregunta "¿cuánto vale Apple hoy?".

Si prefieres no conectarte nunca, puedes escribir los precios a mano en la pantalla de **Posiciones** (botón de actualizar junto a cada activo).

---

## 9. Eventos fiscales

En **Análisis → Eventos fiscales** eliges un año y la app te lista todo lo que tuvo relevancia fiscal:

- Ventas con ganancia o pérdida de capital
- Dividendos cobrados
- Intereses de renta fija (con ISR estimado)
- Ingresos en especie (staking, airdrops)

Es una **lista descriptiva** para que la tengas a la mano cuando hagas tu declaración o la de un cliente. La app **describe, no calcula impuestos** — la decisión fiscal es tuya.

Hay un botón **"Consultar asesor"** que abre la agenda de citas, por si quieres canalizar a alguien (o agendar tú).

---

## 10. Respaldos: ¡lo más importante!

Como tus datos viven **solo en tu computadora**, tú eres responsable de respaldarlos. Es la otra cara de la privacidad total. Tómalo en serio.

### Para respaldar
1. **Configuración → Tus datos → Respaldar a archivo**.
2. Opcional pero recomendado: activa **"Cifrar respaldo con PIN"** y pon un PIN. Así, aunque alguien encuentre el archivo, no puede leerlo.
3. Guarda el archivo en un lugar seguro: una USB, tu OneDrive, donde tú decidas.

### Para restaurar (en una computadora nueva, por ejemplo)
1. **Configuración → Tus datos → Restaurar desde archivo**.
2. Elige tu archivo de respaldo.
3. Si lo cifraste, te pedirá el PIN.

> ⚠️ **Si cifras un respaldo y olvidas el PIN, no hay forma de recuperarlo.** Ni nosotros podemos. Guarda tu PIN como guardas la contraseña del banco.

> 💡 **Recomendación:** respalda al menos una vez al mes y siempre antes de cambiar de computadora. La app ya hace copias internas automáticas, pero un respaldo a archivo tuyo es tu red de seguridad real.

---

## 11. Tu licencia

La app tiene cuatro planes: **Free, Pro, Premium y Lifetime**. El plan Free es gratis y no caduca.

Para ver qué incluye cada uno, haz clic en tu plan (la etiqueta abajo a la izquierda) o en cualquier candado 🔒 dentro de la app. Se abre una tabla comparativa con botón de compra.

### Cómo activar una licencia que compraste
1. Compra en Gumroad (el botón te lleva).
2. Te llega un **código de activación** por correo.
3. En la app: **Configuración → Licencia → pega el código → Activar**.

Funciona **sin internet**: el código se verifica con matemáticas, no con un servidor. Una vez activado, es tuyo.

---

## 12. Preguntas frecuentes

**¿De verdad mis datos no se suben a ningún lado?**
De verdad. No hay cuenta, no hay servidor nuestro, no hay rastreo. Solo se conecta a internet si tú activas los precios en vivo.

**Tengo acciones en dólares y CETES en pesos. ¿Puedo verlos juntos?**
Sí. Cada operación se captura en su moneda y la app convierte todo a tu moneda base para el total.

**¿El ISR que muestra es lo que voy a pagar?**
No. Es una estimación informativa. Tú, como contador, haces el cálculo real.

**¿Qué pasa si mi licencia Premium se vence?**
La app sigue funcionando con las funciones del plan Free. **Tus datos nunca se bloquean.**

**Cambié de computadora. ¿Cómo paso todo?**
Respalda a archivo en la vieja, restaura en la nueva, vuelve a pegar tu código de licencia. Tres pasos.

**¿Puedo cambiar el idioma o el tema?**
Sí, cuando quieras, desde Configuración. Hay 5 idiomas y temas claro/oscuro/automático.

**Perdí mi código de licencia.**
Búscalo en tu correo de compra de Gumroad. Si no aparece, usa el botón de contacto en Ayuda con tu recibo y te lo reenviamos.

---

¿Algo no quedó claro? En la app, ve a **Ayuda → Reportar un problema**: copia un reporte con un clic y mándalo por el formulario de contacto.

*Hecho para inversionistas mexicanos. 100% local: tus datos jamás salen de tu equipo.*
