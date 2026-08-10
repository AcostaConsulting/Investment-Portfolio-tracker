import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { numeroOUndefined } from '../../engine/numero'
import { CampoNumero } from '../../ui/CampoNumero'
import { useApp } from '../../state/store'
import type { Posicion } from '../../engine/portafolio'

/** Alta rápida de alerta piso/techo desde la fila de Posiciones. */
/** Lee un campo con la regla compartida de `engine/numero.ts` (AUDITORIA-ROBUSTEZ.md #4). */
const num = (texto: string): number => numeroOUndefined(texto) ?? 0

export function AlertaPrecioModal({ posicion, alCerrar }: { posicion: Posicion; alCerrar: () => void }) {
  const { t } = useTranslation()
  const guardarAlertaPrecio = useApp((s) => s.guardarAlertaPrecio)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const valida = num(min) > 0 || num(max) > 0

  function guardar() {
    if (!valida) return
    guardarAlertaPrecio({
      id: crypto.randomUUID(),
      activoId: posicion.activo.id,
      ...(num(min) > 0 ? { precioMin: num(min) } : {}),
      ...(num(max) > 0 ? { precioMax: num(max) } : {}),
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
          <CampoNumero valor={min} alCambiar={setMin} autoFocus />
        </div>
        <div className="campo">
          <label>
            {t('alertasPrecio.precioMax')} ({posicion.activo.moneda})
          </label>
          <CampoNumero valor={max} alCambiar={setMax} />
        </div>
      </div>
    </Modal>
  )
}
