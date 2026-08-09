/**
 * Corrección asistida del tipo de cambio al del DOF (handoff §19.8, paso 5).
 *
 * 🔴 Esto reescribe números que el usuario ya vio en su reporte fiscal, así
 * que la pantalla existe justamente para que NO sea silencioso: se listan las
 * operaciones una por una con su TC de antes y el que corresponde, se suma el
 * efecto, y no se aplica nada hasta que el usuario lo pide.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { Cifra } from '../../ui/Cifra'
import { useApp } from '../../state/store'
import { formatoFecha, formatoMoneda } from '../../ui/formato'
import { crearTablaFix, type TablaFix } from '../../engine/tcDof'
import {
  correccionesTcDof,
  resumirCorrecciones,
  type CorreccionTc,
} from '../../engine/correccionTcDof'

export function CorregirTcDof({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const corregirTiposCambio = useApp((s) => s.corregirTiposCambio)
  const [tabla, setTabla] = useState<TablaFix | undefined>()
  const [aplicadas, setAplicadas] = useState(0)

  // La serie va en su propio chunk: se carga al abrir esta pantalla, no antes.
  useEffect(() => {
    if (!abierto || tabla) return
    let cancelado = false
    void import('../../datos/tcDofSerie').then((m) => {
      if (!cancelado) setTabla(crearTablaFix(m.SERIE_FIX))
    })
    return () => {
      cancelado = true
    }
  }, [abierto, tabla])

  const correcciones = useMemo(
    () => (tabla ? correccionesTcDof(doc.operaciones, tabla, doc.ajustes.monedaBase) : []),
    [tabla, doc.operaciones, doc.ajustes.monedaBase],
  )
  const resumen = useMemo(() => resumirCorrecciones(correcciones), [correcciones])
  const base = doc.ajustes.monedaBase
  const porActivo = useMemo(() => new Map(doc.activos.map((a) => [a.id, a])), [doc.activos])

  function aplicar() {
    corregirTiposCambio(correcciones)
    setAplicadas(correcciones.length)
  }

  function cerrar() {
    setAplicadas(0)
    alCerrar()
  }

  return (
    <Modal
      titulo={t('tcDof.titulo')}
      abierto={abierto}
      alCerrar={cerrar}
      // Seis columnas no caben en el ancho normal: sin esto la de "Efecto"
      // —la que el usuario viene a ver— quedaba fuera de cuadro y había que
      // hacer scroll horizontal de todo el modal, texto incluido.
      ancho={860}
      pie={
        <>
          <button className="btn" onClick={cerrar}>
            {aplicadas > 0 ? t('comunes.cerrar') : t('comunes.cancelar')}
          </button>
          {aplicadas === 0 && correcciones.length > 0 && (
            <button className="btn btn-primario" onClick={aplicar}>
              {t('tcDof.aplicar', { cantidad: correcciones.length })}
            </button>
          )}
        </>
      }
    >
      {aplicadas > 0 ? (
        <p className="ayuda">{t('tcDof.listo', { cantidad: aplicadas })}</p>
      ) : (
        <>
          <p className="ayuda" style={{ marginTop: 0 }}>
            {t('tcDof.explicacion')}
          </p>

          {!tabla ? (
            <p className="ayuda">{t('formOperacion.tcCargando')}</p>
          ) : correcciones.length === 0 ? (
            <p className="ayuda">{t('tcDof.nadaQueCorregir')}</p>
          ) : (
            <>
              <div style={{ margin: '14px 0' }}>
                <span className="etiqueta">{t('tcDof.efectoTotal')}</span>{' '}
                <Cifra valor={resumen.deltaBase} moneda={base} signo />{' '}
                <span className="mini suave">{t('tcDof.efectoNota')}</span>
              </div>

              <table className="libro">
                <thead>
                  <tr>
                    <th>{t('comunes.fecha')}</th>
                    <th>{t('comunes.activo')}</th>
                    <th>{t('comunes.tipo')}</th>
                    <th className="num">{t('tcDof.tcActual')}</th>
                    <th className="num">{t('tcDof.tcNuevo')}</th>
                    <th className="num">{t('tcDof.efecto')}</th>
                  </tr>
                </thead>
                <tbody>
                  {correcciones.map((c: CorreccionTc) => (
                    <tr key={c.operacionId}>
                      <td className="cifra mini">{formatoFecha(c.fecha)}</td>
                      <td>{porActivo.get(c.activoId)?.simbolo ?? '?'}</td>
                      <td className="mini">{t(`operaciones.${c.tipo}`)}</td>
                      <td className="num cifra">{c.tcActual.toFixed(4)}</td>
                      <td className="num cifra">
                        {c.tcDof.toFixed(4)}
                        <div className="mini suave">{t('tcDof.fixDel', { fecha: c.fechaFix })}</div>
                      </td>
                      <td className="num">
                        <Cifra valor={c.importeDofBase - c.importeActualBase} moneda={base} signo />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="ayuda" style={{ marginTop: 14 }}>
                {t('tcDof.aviso')}
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
