import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../state/store'
import { useUi } from '../state/ui'
import { planMinimoPara, tieneCapacidad, type Capacidad } from '../licencias/planes'
import { Icono } from './Icono'

/**
 * Envuelve una función de pago. Si el plan no alcanza, muestra el candado
 * amistoso que abre el modal de comparación de planes — el usuario ve
 * exactamente qué obtiene y puede comprar desde ahí.
 */
export function PuertaPremium({ capacidad, children }: { capacidad: Capacidad; children: ReactNode }) {
  const { t } = useTranslation()
  const plan = useApp((s) => s.plan)
  const abrirModalPlanes = useUi((s) => s.abrirModalPlanes)

  if (tieneCapacidad(plan, capacidad)) return <>{children}</>

  const minimo = planMinimoPara(capacidad)
  const nombrePlan = t(minimo === 'pro' ? 'licencia.planPro' : 'licencia.planPremium')

  return (
    <button className="tarjeta vacio puerta-premium" onClick={abrirModalPlanes}>
      <span style={{ color: 'var(--accent)' }}>
        <Icono nombre="candado" tam={28} />
      </span>
      <h3>{t('licencia.desbloquea', { plan: nombrePlan })}</h3>
      <span className="btn btn-primario">{t('planes.verPlanes')}</span>
    </button>
  )
}
