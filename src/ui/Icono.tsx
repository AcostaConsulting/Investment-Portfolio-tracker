/** Set propio de iconos de trazo, 16px, consistentes con la estética. */

const RUTAS = {
  resumen: 'M3 12h3l2-7 4 14 2-7h4',
  posiciones: 'M3 5l9-3 9 3-9 3-9-3zm0 7l9 3 9-3M3 17l9 3 9-3',
  movimientos: 'M4 7h13m0 0-3-3m3 3-3 3M20 17H7m0 0 3-3m-3 3 3 3',
  rentaFija: 'M3 9l9-6 9 6H3zm2 0v8m4-8v8m6-8v8m4-8v8M3 21h18m-16-4h14',
  analisis: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  metas: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 12m-6 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
  configuracion:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8.5 3a8.5 8.5 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.9a8.6 8.6 0 0 0-2-1.2L15.5 2h-4l-.5 2.5a8.6 8.6 0 0 0-2 1.2l-2.4-.9-2 3.5 2 1.5a8.5 8.5 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-.9a8.6 8.6 0 0 0 2 1.2l.5 2.5h4l.5-2.5a8.6 8.6 0 0 0 2-1.2l2.4.9 2-3.5-2-1.5c.07-.4.1-.8.1-1.2z',
  mas: 'M12 5v14M5 12h14',
  lapiz: 'M4 20l4-1L20 7l-3-3L5 16l-1 4zm10-13 3 3',
  basura: 'M5 7h14m-9-3h4M7 7l1 13h8l1-13m-7 4v6m4-6v6',
  cerrar: 'M6 6l12 12M18 6 6 18',
  alerta: 'M12 4a5 5 0 0 0-5 5v4l-2 3h14l-2-3V9a5 5 0 0 0-5-5zm-2 14a2 2 0 0 0 4 0',
  candado: 'M6 11V8a6 6 0 1 1 12 0v3m-13 0h14v9H5v-9zm7 3v3',
  palomita: 'M4 13l5 5L20 7',
  advertencia: 'M12 3 2 20h20L12 3zm0 7v5m0 3v.5',
  descargar: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16',
  refrescar: 'M20 8A8 8 0 1 0 21 14m-1-9v4h-4',
  calendario: 'M5 5h14v16H5V5zm0 5h14M9 3v4m6-4v4',
  flecha: 'M9 6l6 6-6 6',
  sol: 'M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  luna: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  ayuda: 'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0M9.5 9a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2-2.5 3.5M12 17v.5',
  copiar: 'M9 9h11v12H9V9zm-5 8V3h11',
  externo: 'M14 4h6v6m0-6L10 14M9 5H4v15h15v-5',
} as const

export type NombreIcono = keyof typeof RUTAS

export function Icono({
  nombre,
  tam = 16,
}: {
  nombre: NombreIcono
  tam?: number
}) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={RUTAS[nombre]} />
    </svg>
  )
}
