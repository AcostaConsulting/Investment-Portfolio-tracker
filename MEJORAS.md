# Mejoras que le haría al Tracker de Portafolio

Lista honesta y priorizada, pensando en el producto real (un contador mexicano que invierte) y no solo en lo técnico. Cada mejora trae **para qué sirve**, **qué tan difícil es** (🟢 fácil · 🟡 media · 🔴 grande) y **por qué importa**.

---

## 1. Alto impacto para ti como usuario

### 1.1 Gráfica de evolución del portafolio en el tiempo 🟡
**Qué:** una línea que muestre cómo ha crecido (o caído) tu portafolio mes a mes, no solo el valor de hoy.
**Por qué:** hoy la app guarda una "foto" diaria del valor total, pero no la dibuja. Ya tenemos los datos; falta la gráfica. Es lo primero que un inversionista quiere ver al abrir la app.

### 1.2 Calendario de ingresos futuros 🟡
**Qué:** una vista que diga "el 15 de marzo cobras el cupón del Bono M, el 20 vence tu CETES, en abril Apple paga dividendo".
**Por qué:** la app ya conoce las fechas de cupón y vencimiento; juntarlas en un calendario convierte datos sueltos en algo accionable para planear tu flujo.

### 1.3 Reporte fiscal anual en PDF 🟡
**Qué:** un botón que genere un PDF con todos tus eventos fiscales del año (ganancias, pérdidas, dividendos, intereses, ISR estimado) listo para imprimir o adjuntar a tu declaración.
**Por qué:** tú eres contador — esto es oro. Hoy los eventos fiscales se ven en pantalla pero no se exportan. El motor de cálculo ya existe; solo falta el "papel".

### 1.4 Reinversión automática de CETES (rollover) 🟡
**Qué:** marcar un CETES como "se reinvierte al vencer" y que la app cree la operación siguiente sola.
**Por qué:** así operan en cetesdirecto la mayoría de los ahorradores. Hoy hay que capturar cada reinversión a mano.

### 1.5 UDI automática desde Banxico 🟡
**Qué:** que el valor de la UDI (para tus UDIBONOS) se actualice solo, en vez de teclearlo en Configuración.
**Por qué:** Banxico publica la UDI diario. Requiere que pidas un token gratuito a Banxico y lo pegues una vez. Mientras tanto, el valor manual funciona pero hay que recordarlo.

### 1.6 Avisos nativos de Windows cuando se dispara una alerta de precio 🟢
**Qué:** que Windows te muestre una notificación ("BTC superó $2,000,000") aunque la app esté minimizada.
**Por qué:** hoy la alerta solo se ve si abres la app. Una notificación real la hace útil de verdad.

---

## 2. Robustez (que nunca te falle ni pierdas datos)

### 2.1 Recordatorio de respaldo 🟢
**Qué:** un aviso suave cada cierto tiempo: "hace 30 días que no respaldas tus datos".
**Por qué:** tus datos viven solo en tu computadora (esa es la promesa). El precio de eso es que el respaldo es tu responsabilidad. Un recordatorio evita la tragedia de un disco duro muerto.

### 2.2 Respaldo automático a una carpeta que tú elijas 🟡
**Qué:** además del respaldo manual, que la app guarde una copia (por ejemplo en tu OneDrive o Google Drive local) cada semana.
**Por qué:** "100% local" no pelea con "respaldado en tu propia nube personal". Tú decides la carpeta; sigue siendo tu archivo.

### 2.3 Plan B para los precios de acciones 🟡
**Qué:** Yahoo Finance a veces cambia su forma de entregar precios y podría dejar de funcionar. Hay una ruta alterna ya identificada.
**Por qué:** es el único punto frágil de los precios en vivo. Vale tener el respaldo listo antes de que falle.

### 2.4 Firma digital del instalador 🟡
**Qué:** comprar un certificado para firmar el `.exe`.
**Por qué:** sin firma, Windows muestra "editor desconocido" al instalar y asusta a algunos compradores. Con firma, instala limpio. Es un costo anual, no de programación.

### 2.5 Pruebas de la interfaz, no solo del cálculo 🟡
**Qué:** hoy el "cerebro" (cálculos de portafolio, renta fija, impuestos) tiene 116 pruebas automáticas. La parte visual (botones, formularios) no.
**Por qué:** da más confianza al hacer cambios futuros sin romper lo que ya funciona. Es inversión técnica, invisible para ti, pero paga a largo plazo.

---

## 3. Comodidad del día a día

### 3.1 Buscador global 🟢
Escribir "AAPL" o "CETES" y saltar directo. Cuando tengas muchos activos, se agradece.

### 3.2 "Deshacer" después de borrar 🟢
Si eliminas una operación por error, un botón de "deshacer" por unos segundos. Hoy la confirmación ayuda, pero un undo es más amable.

### 3.3 Importar estados de cuenta de casas de bolsa mexicanas 🔴
**Qué:** que la app entienda directamente los archivos de GBM, Kuspit, Bursanet, etc.
**Por qué:** hoy importas desde Excel con mapeo de columnas (que ya es flexible). Soportar cada formato nativo es mucho trabajo, pero sería un diferenciador enorme. Lo dejo marcado como visión, no como prioridad.

### 3.4 Edición rápida en la tabla 🟡
Cambiar el precio o la cantidad de una operación dando doble clic en la celda, sin abrir el formulario completo.

---

## 4. Negocio (vender más, no solo construir)

### 4.1 Publicar la página de producto 🟢
La landing ya está hecha (`landing/index.html`). Falta subirla a GitHub Pages para que tenga una dirección pública y la gente pueda comprar.

### 4.2 Actualizar el "sello de seguridad" de la descarga 🟢
La página tiene un espacio (`[SHA256-PENDING]`) para el código que prueba que el instalador no fue alterado. Se llena con un comando después de generar cada versión.

### 4.3 Periodo de prueba de funciones Premium 🟡
Dejar probar 14 días las funciones de pago. Convierte más curiosos en compradores que un muro seco.

---

## Mi recomendación si solo eligieras 3

1. **Reporte fiscal anual en PDF** (1.3) — es tu profesión, te ahorra horas y nadie más en el mercado mexicano lo tiene bien hecho.
2. **Gráfica de evolución en el tiempo** (1.1) — es lo que hace que la app se sienta "viva" cada vez que la abres.
3. **Recordatorio + respaldo automático** (2.1 y 2.2) — barato de hacer y te protege del único riesgo real de una app 100% local: perder el equipo sin copia.

---

*Documento generado al cierre de la Sesión 2. El detalle técnico de cada punto (archivos, dependencias) está en `handoff.md`.*
