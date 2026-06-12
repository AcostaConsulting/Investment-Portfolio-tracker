import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { useApp } from '../../state/store'
import type { Posicion } from '../../engine/portafolio'

/** Alta rápida de alerta piso/techo desde la fila de Posiciones. */
export function AlertaPrecioModal({ posicion, alCerrar }: { posicion: Posicion; alCerrar: () => void }) {
  const { t } = useTranslation()
  const guardarAlertaPrecio = useApp((s) => s.guardarAlertaPrecio)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const valida = Number(min) > 0 || Number(max) > 0

  function guardar() {
    if (!valida) return
    guardarAlertaPrecio({
      id: crypto.randomUUID(),
      activoId: posicion.activo.id,
      ...(Number(min) > 0 ? { precioMin: Number(min) } : {}),
      ...(Number(max) > 0 ? { precioMax: Number(max) } : {}),
      activa: true,
    })
    alCerrar()
  }

  return (
    <Modal
      titulo={`${t('alertasPrecio.nueva')} · ${posicion.activo.simbolo}`}
      abierto
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn" onClick={alCerrar}>
            {t('comunes.cancelar')}
          </button>
          <button className="btn btn-primario" onClick={guardar} disabled={!valida}>
            {t('comunes.guardar')}
          </button>
        </>
      }
    >
      <div className="form-rejilla">
        <div className="campo">
          <label>
            {t('alertasPrecio.precioMin')} ({posicion.activo.moneda})
          </label>
          <input type="number" step="any" min="0" value={min} onChange={(e) => setMin(e.target.value)} autoFocus />
        </div>
        <div className="campo">
          <label>
            {t('alertasPrecio.precioMax')} ({posicion.activo.moneda})
          </label>
          <input type="number" step="any" min="0" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
