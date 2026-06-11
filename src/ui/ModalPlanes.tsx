/** Modal de comparación de planes: 4 columnas, compra directa en Gumroad. */

import { useTranslation } from 'react-i18next'
import { useApp } from '../state/store'
import { useUi } from '../state/ui'
import { compararPlanes, type CapacidadesPlan } from '../engine/planes'
import { PRECIOS_USD, type Plan } from '../licencias/planes'
import { URLS_GUMROAD, USD_MXN_DISPLAY } from '../config/planes'
import { abrirExterno } from '../lib/externo'
import { Modal } from './Modal'
import { Icono } from './Icono'
import { formatoMoneda } from './formato'

const ORDEN: Record<Plan, number> = { free: 0, pro: 1, premium: 2, lifetime: 3 }

const LLAVE_PLAN = {
  free: 'licencia.planFree',
  pro: 'licencia.planPro',
  premium: 'licencia.planPremium',
  lifetime: 'licencia.planLifetime',
} as const

export function ModalPlanes() {
  const { t } = useTranslation()
  const abierto = useUi((s) => s.modalPlanesAbierto)
  const cerrar = useUi((s) => s.cerrarModalPlanes)
  const planActual = useApp((s) => s.plan)
  const comparacion = compararPlanes()

  if (!abierto) return null

  return (
    <Modal titulo={t('planes.titulo')} abierto alCerrar={cerrar} ancho={880}>
      <div className="planes-rejilla">
        {comparacion.planes.map((plan) => {
          const precio = plan === 'free' ? undefined : PRECIOS_USD[plan]
          const esActual = plan === planActual
          const esMenor = ORDEN[plan] < ORDEN[planActual]
          return (
            <div key={plan} className={`plan-col ${esActual ? 'actual' : ''} ${esMenor ? 'menor' : ''}`}>
              <div className="plan-nombre">{t(LLAVE_PLAN[plan])}</div>
              {esActual && <span className="chip acento">{t('planes.actual')}</span>}
              <div className="plan-precio">
                {precio ? (
                  <>
                    <span className="cifra">${precio.monto}</span>
                    <span className="mini suave"> USD{precio.tipo === 'mensual' ? t('planes.porMes') : ''}</span>
                    <div className="mini suave">
                      ≈ {formatoMoneda(precio.monto * USD_MXN_DISPLAY, 'MXN', 0)}
                      {precio.tipo === 'mensual' ? t('planes.porMes') : ''}
                    </div>
                  </>
                ) : (
                  <span className="cifra">$0</span>
                )}
              </div>
              {plan !== 'free' && !esMenor && !esActual && (
                <button className="btn btn-primario btn-mini" onClick={() => abrirExterno(URLS_GUMROAD[plan])}>
                  {t('planes.comprar')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <table className="libro planes-tabla">
        <tbody>
          {comparacion.filas.map((fila) => (
            <tr key={fila.clave}>
              <td className="mini">{t(`planes.features.${fila.clave as keyof CapacidadesPlan}`)}</td>
              {comparacion.planes.map((plan) => {
                const celda = fila.porPlan[plan]
                return (
                  <td key={plan} className={`num ${plan === planActual ? 'col-actual' : ''}`}>
                    {celda === true ? (
                      <span className="positivo">
                        <Icono nombre="palomita" tam={14} />
                      </span>
                    ) : celda === false ? (
                      <span className="suave" style={{ opacity: 0.45 }}>
                        —
                      </span>
                    ) : (
                      <span className="cifra mini">{celda}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}
