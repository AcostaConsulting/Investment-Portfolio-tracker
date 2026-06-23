import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from './state/store'
import { useUi } from './state/ui'
import { usePortafolio, useAlertasDisparadas } from './state/selectores'
import { detectarNuevasAlertas } from './engine/notificaciones'
import { notificarSistema } from './lib/notificar'
import { formatoMoneda } from './ui/formato'
import { temaEfectivo, useTema } from './tema'
import { ModalPlanes } from './ui/ModalPlanes'
import { cambiarIdioma } from './i18n'
import { Icono, type NombreIcono } from './ui/Icono'
import { Resumen } from './features/resumen/Resumen'
import { Posiciones } from './features/posiciones/Posiciones'
import { Movimientos } from './features/movimientos/Movimientos'
import { RentaFija } from './features/rentafija/RentaFija'
import { Analisis } from './features/analisis/Analisis'
import { Ayuda } from './features/ayuda/Ayuda'
import { Configuracion } from './features/configuracion/Configuracion'
import { Onboarding } from './features/onboarding/Onboarding'
import { Tour } from './features/onboarding/Tour'

export type Vista =
  | 'resumen'
  | 'posiciones'
  | 'movimientos'
  | 'rentafija'
  | 'analisis'
  | 'ayuda'
  | 'configuracion'

const NAVEGACION: { vista: Vista; icono: NombreIcono }[] = [
  { vista: 'resumen', icono: 'resumen' },
  { vista: 'posiciones', icono: 'posiciones' },
  { vista: 'movimientos', icono: 'movimientos' },
  { vista: 'rentafija', icono: 'rentaFija' },
  { vista: 'analisis', icono: 'analisis' },
  { vista: 'ayuda', icono: 'ayuda' },
  { vista: 'configuracion', icono: 'configuracion' },
]

const ETIQUETA_NAV = {
  resumen: 'nav.resumen',
  posiciones: 'nav.posiciones',
  movimientos: 'nav.movimientos',
  rentafija: 'nav.rentaFija',
  analisis: 'nav.analisis',
  ayuda: 'nav.ayuda',
  configuracion: 'nav.configuracion',
} as const

export default function App() {
  const { t } = useTranslation()
  const cargado = useApp((s) => s.cargado)
  const inicializar = useApp((s) => s.inicializar)
  const ajustes = useApp((s) => s.doc.ajustes)
  const onboardingCompletado = useApp((s) => s.doc.onboardingCompletado)
  const tourCompletado = useApp((s) => s.doc.tourCompletado)
  const plan = useApp((s) => s.plan)
  const abrirModalPlanes = useUi((s) => s.abrirModalPlanes)
  const [vista, setVista] = useState<Vista>('resumen')

  useEffect(() => {
    void inicializar()
  }, [inicializar])

  useTema(ajustes.tema)

  useEffect(() => {
    cambiarIdioma(ajustes.idioma)
  }, [ajustes.idioma])

  if (!cargado) return null

  if (!onboardingCompletado) return <Onboarding />

  return (
    <div className="app">
      <aside className="lateral">
        <div className="lateral-marca">
          Tracker de <em>Portafolio</em>
        </div>
        <div className="lateral-lema mini suave">{t('app.lema')}</div>
        {NAVEGACION.map(({ vista: v, icono }) => (
          <button
            key={v}
            className={`nav-item ${vista === v ? 'activo' : ''}`}
            onClick={() => setVista(v)}
            data-tour={v}
          >
            <Icono nombre={icono} />
            {t(ETIQUETA_NAV[v])}
          </button>
        ))}
        <div className="lateral-pie">
          <BotonTema />
          <button
            className={`sello-plan ${plan === 'free' ? '' : 'pago'}`}
            onClick={abrirModalPlanes}
            title={t('planes.titulo')}
          >
            {t(
              plan === 'free'
                ? 'licencia.planFree'
                : plan === 'pro'
                  ? 'licencia.planPro'
                  : plan === 'premium'
                    ? 'licencia.planPremium'
                    : 'licencia.planLifetime',
            )}
          </button>
        </div>
      </aside>
      <main className="contenido">
        {vista === 'resumen' && <Resumen irA={setVista} />}
        {vista === 'posiciones' && <Posiciones />}
        {vista === 'movimientos' && <Movimientos />}
        {vista === 'rentafija' && <RentaFija />}
        {vista === 'analisis' && <Analisis />}
        {vista === 'ayuda' && <Ayuda />}
        {vista === 'configuracion' && <Configuracion />}
      </main>
      {!tourCompletado && <Tour />}
      <SnapshotDiario />
      <NotificadorAlertas />
      <ModalPlanes />
    </div>
  )
}

/** Toggle rápido sol/luna; el selector completo (incl. sistema) vive en Configuración. */
function BotonTema() {
  const { t } = useTranslation()
  const actualizarAjustes = useApp((s) => s.actualizarAjustes)
  // Suscrito al ajuste para re-render; el efectivo se lee del DOM.
  useApp((s) => s.doc.ajustes.tema)
  const oscuro = temaEfectivo() === 'oscuro'
  return (
    <button
      className="btn btn-fantasma btn-mini"
      style={{ alignSelf: 'flex-start' }}
      onClick={() => actualizarAjustes({ tema: oscuro ? 'claro' : 'oscuro' })}
      title={t(oscuro ? 'configuracion.temaClaro' : 'configuracion.temaOscuro')}
    >
      <Icono nombre={oscuro ? 'sol' : 'luna'} tam={15} />
      {t(oscuro ? 'configuracion.temaClaro' : 'configuracion.temaOscuro')}
    </button>
  )
}

/** Registra un punto de historia por día — alimenta los benchmarks. */
function SnapshotDiario() {
  const { totales } = usePortafolio()
  const operaciones = useApp((s) => s.doc.operaciones.length)
  const registrarSnapshot = useApp((s) => s.registrarSnapshot)
  useEffect(() => {
    if (operaciones > 0) registrarSnapshot(totales.valorTotal)
  }, [operaciones, totales.valorTotal, registrarSnapshot])
  return null
}

/**
 * Notifica al SO cuando una alerta de precio pasa de no-disparada a disparada.
 * El "qué cambió" lo decide el motor puro `detectarNuevasAlertas`; aquí solo
 * vive el efecto (disparo nativo) y el estado de "ya notificadas".
 */
function NotificadorAlertas() {
  const { t } = useTranslation()
  const disparadas = useAlertasDisparadas()
  const activadas = useApp((s) => s.doc.ajustes.notificacionesAlertas)
  const yaNotificadas = useRef<Set<string>>(new Set())
  // Las que ya estaban disparadas al abrir la app no se notifican (no es una
  // transición que el usuario haya presenciado): se siembran en silencio.
  const primeraVez = useRef(true)

  useEffect(() => {
    const { nuevas, clavesActuales } = detectarNuevasAlertas(yaNotificadas.current, disparadas)
    yaNotificadas.current = clavesActuales
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    if (!activadas) return
    for (const alerta of nuevas) {
      const cuerpo =
        alerta.tipo === 'min'
          ? t('alertasPrecio.disparadaMin', {
              simbolo: alerta.simbolo,
              precio: formatoMoneda(alerta.precioActual, alerta.moneda),
              umbral: formatoMoneda(alerta.umbral, alerta.moneda),
            })
          : t('alertasPrecio.disparadaMax', {
              simbolo: alerta.simbolo,
              precio: formatoMoneda(alerta.precioActual, alerta.moneda),
              umbral: formatoMoneda(alerta.umbral, alerta.moneda),
            })
      notificarSistema(t('alertasPrecio.notificacionTitulo'), cuerpo)
    }
  }, [disparadas, activadas, t])
  return null
}
