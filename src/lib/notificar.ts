/**
 * Disparo de una notificación nativa del sistema operativo.
 *
 * Es un efecto de plataforma (toca la Notification API del navegador, que en
 * Electron se enruta a la notificación nativa del SO), por eso vive aquí y
 * NO en src/engine — el engine se queda puro. La decisión de QUÉ notificar la
 * toma el motor `detectarNuevasAlertas`; esto solo la ejecuta.
 */

export function notificarSistema(titulo: string, cuerpo: string): void {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
      new Notification(titulo, { body: cuerpo })
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission().then((permiso) => {
        if (permiso === 'granted') new Notification(titulo, { body: cuerpo })
      })
    }
  } catch {
    // Si el SO no soporta notificaciones, nunca rompemos la app por esto.
  }
}
