/**
 * Pantalla de recuperación: el documento existe pero no se pudo usar.
 *
 * Sustituye al comportamiento que la auditoría midió como el peor bug de la app
 * (AUDITORIA-ROBUSTEZ.md §1.3): antes, un `datos.json` ilegible hacía que la app
 * arrancara **como primer uso**, con el onboarding, y el primer clic lo
 * sobrescribía con un documento vacío — 400 operaciones convertidas en 521
 * bytes sin una sola advertencia.
 *
 * Tres reglas que esta pantalla no rompe:
 * 1. La copia del archivo original **ya existe** cuando el usuario llega aquí.
 *    Ningún clic puede destruirla.
 * 2. Mientras esta pantalla esté abierta, la app **no escribe nada** en disco.
 * 3. Restaurar un respaldo es una decisión del usuario, con la fecha, el tamaño
 *    y el número de operaciones a la vista. Nunca se elige por él en silencio.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../state/store'
import { formatoFecha } from '../../ui/formato'
import { Icono } from '../../ui/Icono'
import type { ResumenRespaldo } from '../../shared/api'

function tamano(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`
}

export function Recuperacion() {
  const { t } = useTranslation()
  const recuperacion = useApp((s) => s.recuperacion)!
  const restaurarRespaldo = useApp((s) => s.restaurarRespaldo)
  const empezarDeCero = useApp((s) => s.empezarDeCero)
  const [ocupado, setOcupado] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [confirmando, setConfirmando] = useState(false)

  async function restaurar(nombre: string) {
    setOcupado(nombre)
    setError(undefined)
    const r = await restaurarRespaldo(nombre)
    setOcupado(undefined)
    if (!r.ok) setError(t('recuperacion.errorRestaurar'))
  }

  const utilizables = recuperacion.respaldos.filter((r) => r.legible)

  return (
    <div className="onboarding">
      <div className="onboarding-tarjeta recuperacion-tarjeta">
        <div className="recuperacion-encabezado">
          <Icono nombre="advertencia" tam={22} />
          <h2>{t('recuperacion.titulo')}</h2>
        </div>

        <p className="suave">
          {recuperacion.motivo === 'forma'
            ? t('recuperacion.explicacionForma', { campos: recuperacion.detalle })
            : t('recuperacion.explicacionIlegible')}
        </p>

        {recuperacion.copia && (
          <p className="mini recuperacion-copia">
            {t('recuperacion.copiaEn')}
            <code>{recuperacion.copia}</code>
          </p>
        )}

        <p className="mini suave">{t('recuperacion.noSeGuarda')}</p>

        <div className="regla-doble" />

        <h3 className="mini">{t('recuperacion.elegirRespaldo')}</h3>

        {utilizables.length === 0 ? (
          <p className="vacio">{t('recuperacion.sinRespaldos')}</p>
        ) : (
          <ul className="recuperacion-lista">
            {utilizables.map((r) => (
              <FilaRespaldo
                key={r.nombre}
                respaldo={r}
                ocupado={ocupado === r.nombre}
                deshabilitado={!!ocupado}
                alRestaurar={() => void restaurar(r.nombre)}
              />
            ))}
          </ul>
        )}

        {error && <p className="negativo mini">{error}</p>}

        <div className="regla-doble" />

        {confirmando ? (
          <div className="recuperacion-confirmar">
            <p className="mini">{t('recuperacion.confirmarTexto')}</p>
            <div className="fila-acciones">
              <button className="btn btn-fantasma" onClick={() => setConfirmando(false)}>
                {t('comunes.cancelar')}
              </button>
              <button className="btn btn-peligro" onClick={empezarDeCero}>
                {t('recuperacion.confirmarSi')}
              </button>
            </div>
          </div>
        ) : (
          <div className="recuperacion-salida">
            <span className="mini suave">{t('recuperacion.ningunoSirve')}</span>
            <button className="btn btn-fantasma btn-mini" onClick={() => setConfirmando(true)}>
              {t('recuperacion.empezarDeCero')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FilaRespaldo({
  respaldo,
  ocupado,
  deshabilitado,
  alRestaurar,
}: {
  respaldo: ResumenRespaldo
  ocupado: boolean
  deshabilitado: boolean
  alRestaurar: () => void
}) {
  const { t } = useTranslation()
  const fecha = respaldo.fechaIso ? respaldo.fechaIso.slice(0, 10) : ''
  const hora = respaldo.fechaIso ? respaldo.fechaIso.slice(11, 16) : ''
  return (
    <li className="recuperacion-fila">
      <div>
        <strong>
          {fecha ? formatoFecha(fecha) : respaldo.nombre} {hora}
        </strong>
        <div className="mini suave">
          {t('recuperacion.contenido', {
            activos: respaldo.activos ?? 0,
            operaciones: respaldo.operaciones ?? 0,
          })}{' '}
          · {tamano(respaldo.bytes)}
        </div>
      </div>
      <button className="btn btn-primario btn-mini" onClick={alRestaurar} disabled={deshabilitado}>
        {ocupado ? t('recuperacion.restaurando') : t('recuperacion.restaurar')}
      </button>
    </li>
  )
}
