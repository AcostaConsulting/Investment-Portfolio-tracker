/**
 * Barra de guardado fallido.
 *
 * Existe porque `store.ts` descartaba el rechazo del guardado con `void` y un
 * `datos.json` bloqueado por OneDrive —o marcado de solo lectura— hacía que la
 * app siguiera aceptando cambios **sin escribir ni uno**, sin avisar
 * (AUDITORIA-ROBUSTEZ.md §1.2). Medido: media hora de captura podía perderse.
 *
 * Es persistente a propósito: no se puede cerrar mientras el error siga, porque
 * un aviso que se descarta es exactamente el que no se lee. La salida de
 * emergencia —guardar una copia donde el usuario quiera— convierte el P0 en una
 * molestia: se lleva sus datos aunque el archivo original esté bloqueado.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../state/store'
import { Icono } from './Icono'

/**
 * Los códigos de Windows que sí podemos explicar en palabras del usuario.
 * `as const` para que las llaves i18n conserven su tipo literal — el
 * diccionario está tipado y un `string` suelto no pasa.
 */
const MENSAJE_POR_CODIGO = {
  EBUSY: 'guardado.falloBloqueado',
  // En Windows, EPERM sale tanto con el atributo de solo lectura como con un
  // handle abierto por otro proceso: no se pueden distinguir, así que el texto
  // nombra las dos causas en vez de adivinar una (comprobado con `attrib +R`,
  // que devuelve EPERM y no EACCES).
  EPERM: 'guardado.falloPermiso',
  EACCES: 'guardado.falloSoloLectura',
  EROFS: 'guardado.falloSoloLectura',
  ENOSPC: 'guardado.falloSinEspacio',
} as const

export function BarraGuardado() {
  const { t } = useTranslation()
  const errorGuardado = useApp((s) => s.errorGuardado)
  const conflictoGuardado = useApp((s) => s.conflictoGuardado)
  const guardarCopiaDeEmergencia = useApp((s) => s.guardarCopiaDeEmergencia)
  const guardarDeTodosModos = useApp((s) => s.guardarDeTodosModos)
  const descartarYRecargar = useApp((s) => s.descartarYRecargar)
  const [guardando, setGuardando] = useState(false)
  const [copiaEn, setCopiaEn] = useState<string | undefined>()

  // §22.3 — otro escribió el archivo por debajo. Va antes que el error de
  // guardado porque es más grave: aquí hay trabajo de dos dueños en juego, y
  // resolverlo mal pierde el de alguno. La app ya NO está guardando.
  if (conflictoGuardado) {
    return (
      <div className="barra-guardado" role="alert">
        <Icono nombre="advertencia" tam={18} />
        <div className="barra-guardado-texto">
          <strong>{t('guardado.conflicto')}</strong> <span>{t('guardado.conflictoDetalle')}</span>
          <div className="mini">{t('guardado.conflictoRespaldos')}</div>
          <div className="mini barra-guardado-ruta">{conflictoGuardado.copiaExterna}</div>
          <div className="mini barra-guardado-ruta">{conflictoGuardado.copiaMia}</div>
        </div>
        <button className="btn btn-mini" onClick={() => void guardarDeTodosModos()}>
          {t('guardado.conflictoGuardarMio')}
        </button>
        <button className="btn btn-mini" onClick={() => void descartarYRecargar()}>
          {t('guardado.conflictoRecargar')}
        </button>
      </div>
    )
  }

  if (!errorGuardado) return null

  const clave = MENSAJE_POR_CODIGO[errorGuardado.codigo as keyof typeof MENSAJE_POR_CODIGO] as
    | (typeof MENSAJE_POR_CODIGO)[keyof typeof MENSAJE_POR_CODIGO]
    | undefined

  async function guardarCopia() {
    setGuardando(true)
    const r = await guardarCopiaDeEmergencia()
    setGuardando(false)
    if (r.ok) setCopiaEn(r.ruta)
  }

  return (
    <div className="barra-guardado" role="alert">
      <Icono nombre="advertencia" tam={18} />
      <div className="barra-guardado-texto">
        <strong>{t('guardado.fallo')}</strong>{' '}
        <span>{clave ? t(clave) : t('guardado.falloDetalle', { error: errorGuardado.error })}</span>
        <div className="mini barra-guardado-ruta">{errorGuardado.ruta}</div>
        {copiaEn && <div className="mini">{t('guardado.copiaGuardada', { ruta: copiaEn })}</div>}
      </div>
      <button className="btn btn-mini" onClick={() => void guardarCopia()} disabled={guardando}>
        {t('guardado.guardarCopia')}
      </button>
    </div>
  )
}
