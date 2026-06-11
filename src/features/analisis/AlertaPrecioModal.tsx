import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { useApp } from '../../state/store'
import type { Posicion } from '../../engine/portafolio'

export function AlertaPrecioModal({ posicion, alCerrar }: { posicion: Posicion; alCerrar: () => void }) {
  const { t } = useTranslation()
  const guardarAlertaPrecio = useApp((s) => s.guardarAlertaPrecio)
  const [condicion, setCondicion] = useState<'mayor' | 'menor'>('mayor')
  const [precio, setPrecio] = useState('')

  function guardar() {
    if (!(Number(precio) > 0)) return
    guardarAlertaPrecio({
      id: crypto.randomUUID(),
      activoId: posicion.activo.id,
      condicion,
      precio: Number(precio),
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
          <button className="btn btn-primario" onClick={guardar} disabled={!(Number(precio) > 0)}>
            {t('comunes.guardar')}
          </button>
        </>
      }
    >
      <div className="form-rejilla">
        <div className="campo">
          <label>{t('alertasPrecio.condicion')}</label>
          <select value={condicion} onChange={(e) => setCondicion(e.target.value as 'mayor' | 'menor')}>
            <option value="mayor">{t('alertasPrecio.mayor')}</option>
            <option value="menor">{t('alertasPrecio.menor')}</option>
          </select>
        </div>
        <div className="campo">
          <label>
            {t('comunes.precio')} ({posicion.activo.moneda})
          </label>
          <input type="number" step="any" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus />
        </div>
      </div>
    </Modal>
  )
}
