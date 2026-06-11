import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../state/store'
import { planMinimoPara, tieneCapacidad, type Capacidad } from '../licencias/planes'
import { Icono } from './Icono'

const URL_GUMROAD = 'https://gumroad.com'

/** Envuelve una función de pago: si el plan no alcanza, muestra el candado amistoso. */
export function PuertaPremium({ capacidad, children }: { capacidad: Capacidad; children: ReactNode }) {
  const { t } = useTranslation()
  const plan = useApp((s) => s.plan)

  if (tieneCapacidad(plan, capacidad)) return <>{children}</>

  const minimo = planMinimoPara(capacidad)
  const nombrePlan = t(minimo === 'pro' ? 'licencia.planPro' : 'licencia.planPremium')

  return (
    <div className="tarjeta vacio">
      <span style={{ color: 'var(--accent)' }}>
        <Icono nombre="candado" tam={28} />
      </span>
      <h3>{t('licencia.desbloquea', { plan: nombrePlan })}</h3>
      <a className="btn btn-primario" href={URL_GUMROAD} target="_blank" rel="noreferrer">
        {t('licencia.comprar')}
      </a>
    </div>
  )
}
