import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from './state/store'
import { usePortafolio } from './state/selectores'
import { useTema } from './tema'
import { cambiarIdioma } from './i18n'
import { Icono, type NombreIcono } from './ui/Icono'
import { tieneCapacidad } from './licencias/planes'
import { Resumen } from './features/resumen/Resumen'
import { Posiciones } from './features/posiciones/Posiciones'
import { Movimientos } from './features/movimientos/Movimientos'
import { RentaFija } from './features/rentafija/RentaFija'
import { Analisis } from './features/analisis/Analisis'
import { Metas } from './features/metas/Metas'
import { Configuracion } from './features/configuracion/Configuracion'
import { Onboarding } from './features/onboarding/Onboarding'
import { Tour } from './features/onboarding/Tour'

export type Vista =
  | 'resumen'
  | 'posiciones'
  | 'movimientos'
  | 'rentafija'
  | 'analisis'
  | 'metas'
  | 'configuracion'

const NAVEGACION: { vista: Vista; icono: NombreIcono; premium?: boolean }[] = [
  { vista: 'resumen', icono: 'resumen' },
  { vista: 'posiciones', icono: 'posiciones' },
  { vista: 'movimientos', icono: 'movimientos' },
  { vista: 'rentafija', icono: 'rentaFija' },
  { vista: 'analisis', icono: 'analisis', premium: true },
  { vista: 'metas', icono: 'metas', premium: true },
  { vista: 'configuracion', icono: 'configuracion' },
]

const ETIQUETA_NAV = {
  resumen: 'nav.resumen',
  posiciones: 'nav.posiciones',
  movimientos: 'nav.movimientos',
  rentafija: 'nav.rentaFija',
  analisis: 'nav.analisis',
  metas: 'nav.metas',
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

  const conCandado = (premium?: boolean) => premium && !tieneCapacidad(plan, 'benchmarks')

  return (
    <div className="app">
      <aside className="lateral">
        <div className="lateral-marca">
          Tracker de <em>Portafolio</em>
        </div>
        <div className="lateral-lema mini suave">{t('app.lema')}</div>
        {NAVEGACION.map(({ vista: v, icono, premium }) => (
          <button
            key={v}
            className={`nav-item ${vista === v ? 'activo' : ''}`}
            onClick={() => setVista(v)}
            data-tour={v}
          >
            <Icono nombre={icono} />
            {t(ETIQUETA_NAV[v])}
            {conCandado(premium) && (
              <span className="candadito">
                <Icono nombre="candado" tam={13} />
              </span>
            )}
          </button>
        ))}
        <div className="lateral-pie">
          <span className={`sello-plan ${plan === 'free' ? '' : 'pago'}`}>
            {t(
              plan === 'free'
                ? 'licencia.planFree'
                : plan === 'pro'
                  ? 'licencia.planPro'
                  : plan === 'premium'
                    ? 'licencia.planPremium'
                    : 'licencia.planLifetime',
            )}
          </span>
        </div>
      </aside>
      <main className="contenido">
        {vista === 'resumen' && <Resumen irA={setVista} />}
        {vista === 'posiciones' && <Posiciones />}
        {vista === 'movimientos' && <Movimientos />}
        {vista === 'rentafija' && <RentaFija />}
        {vista === 'analisis' && <Analisis />}
        {vista === 'metas' && <Metas />}
        {vista === 'configuracion' && <Configuracion />}
      </main>
      {!tourCompletado && <Tour />}
      <SnapshotDiario />
    </div>
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
