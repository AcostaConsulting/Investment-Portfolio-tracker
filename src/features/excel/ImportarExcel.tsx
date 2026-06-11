/** Asistente de importación: archivo → mapeo de columnas → revisión → alta. */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../ui/Modal'
import { useApp } from '../../state/store'
import type { Activo, Operacion } from '../../engine/tipos'
import {
  adivinarMapeo,
  celdaATexto,
  convertirFilas,
  CAMPOS_IMPORT,
  type CampoImport,
  type Mapeo,
} from './importar'

interface HojaCargada {
  nombre: string
  encabezados: string[]
  filas: unknown[][]
}

export function ImportarExcel({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation()
  const doc = useApp((s) => s.doc)
  const importarLote = useApp((s) => s.importarLote)

  const [hojas, setHojas] = useState<HojaCargada[]>([])
  const [hojaActiva, setHojaActiva] = useState(0)
  const [mapeo, setMapeo] = useState<Mapeo>({})
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [hecho, setHecho] = useState<number | undefined>()
  const [verErrores, setVerErrores] = useState(false)

  const ETIQUETA_CAMPO: Record<CampoImport, string> = {
    fecha: t('comunes.fecha'),
    simbolo: t('comunes.simbolo'),
    tipo: t('comunes.tipo'),
    cantidad: t('comunes.cantidad'),
    precio: t('comunes.precio'),
    moneda: t('comunes.moneda'),
    tipoCambio: t('formOperacion.tipoCambio', { base: doc.ajustes.monedaBase }),
    comision: t('comunes.comision'),
    nota: t('comunes.nota'),
  }

  async function elegirArchivo() {
    const r = await window.api?.dialogo.abrir({ filtros: [{ nombre: 'Excel', extensiones: ['xlsx', 'xls'] }] })
    if (!r?.abierto || !r.contenidoBase64) return
    const binario = atob(r.contenidoBase64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    const { Workbook } = (await import('exceljs')).default ?? (await import('exceljs'))
    const libro = new Workbook()
    await libro.xlsx.load(bytes.buffer)
    const cargadas: HojaCargada[] = []
    libro.eachSheet((hoja) => {
      const filas: unknown[][] = []
      let encabezados: string[] = []
      hoja.eachRow((fila, numero) => {
        // `values` de exceljs es 1-based: la celda A está en el índice 1.
        const celdas = (fila.values as unknown[]).slice(1)
        if (numero === 1) encabezados = celdas.map((c) => celdaATexto(c))
        else filas.push(celdas)
      })
      if (encabezados.length > 0) cargadas.push({ nombre: hoja.name, encabezados, filas })
    })
    if (cargadas.length === 0) return
    setHojas(cargadas)
    setHojaActiva(0)
    setMapeo(adivinarMapeo(cargadas[0]!.encabezados))
    setPaso(2)
  }

  function cambiarHoja(indice: number) {
    setHojaActiva(indice)
    setMapeo(adivinarMapeo(hojas[indice]!.encabezados))
  }

  const hoja = hojas[hojaActiva]
  const simbolosExistentes = useMemo(
    () => new Set(doc.activos.map((a) => a.simbolo.toUpperCase())),
    [doc.activos],
  )
  const resultado = useMemo(
    () => (hoja ? convertirFilas(hoja.filas, mapeo, doc.ajustes.monedaBase, simbolosExistentes) : undefined),
    [hoja, mapeo, doc.ajustes.monedaBase, simbolosExistentes],
  )

  function importar() {
    if (!resultado || resultado.validas.length === 0) return
    const porSimbolo = new Map(doc.activos.map((a) => [a.simbolo.toUpperCase(), a]))
    const activosNuevos: Activo[] = []
    for (const simbolo of resultado.simbolosNuevos) {
      const primera = resultado.validas.find((f) => f.simbolo === simbolo)!
      const activo: Activo = {
        id: crypto.randomUUID(),
        simbolo,
        nombre: simbolo,
        clase: 'accion',
        moneda: primera.moneda,
      }
      activosNuevos.push(activo)
      porSimbolo.set(simbolo, activo)
    }
    const operaciones: Operacion[] = resultado.validas.map((f) => ({
      id: crypto.randomUUID(),
      activoId: porSimbolo.get(f.simbolo)!.id,
      tipo: f.tipo,
      fecha: f.fecha,
      cantidad: f.cantidad,
      precioUnitario: f.precioUnitario,
      moneda: f.moneda,
      tipoCambio: f.tipoCambio,
      ...(f.comision !== undefined ? { comision: f.comision } : {}),
      ...(f.nota !== undefined ? { nota: f.nota } : {}),
    }))
    importarLote(activosNuevos, operaciones)
    setHecho(operaciones.length)
    setPaso(3)
  }

  return (
    <Modal
      titulo={t('excel.importTitulo')}
      abierto={abierto}
      alCerrar={alCerrar}
      pie={
        paso === 2 ? (
          <>
            <button className="btn" onClick={alCerrar}>
              {t('comunes.cancelar')}
            </button>
            <button
              className="btn btn-primario"
              disabled={!resultado || resultado.validas.length === 0}
              onClick={importar}
            >
              {t('excel.importarFilas', { filas: resultado?.validas.length ?? 0 })}
            </button>
          </>
        ) : (
          <button className="btn btn-primario" onClick={alCerrar}>
            {paso === 3 ? t('comunes.listo') : t('comunes.cerrar')}
          </button>
        )
      }
    >
      {paso === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <p className="suave" style={{ margin: 0 }}>
            {t('excel.plantillaAyuda')}
          </p>
          <button className="btn btn-primario" onClick={() => void elegirArchivo()}>
            {t('excel.elegirArchivo')}
          </button>
        </div>
      )}

      {paso === 2 && hoja && resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hojas.length > 1 && (
            <div className="campo">
              <label>{t('excel.hoja')}</label>
              <select value={hojaActiva} onChange={(e) => cambiarHoja(Number(e.target.value))}>
                {hojas.map((h, i) => (
                  <option key={h.nombre} value={i}>
                    {h.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="etiqueta" style={{ marginBottom: 8 }}>
              {t('excel.importPaso2')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
              {CAMPOS_IMPORT.map((campo) => (
                <div key={campo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mini" style={{ width: 110, fontWeight: 600 }}>
                    {ETIQUETA_CAMPO[campo]}
                  </span>
                  <select
                    style={{ flex: 1 }}
                    value={mapeo[campo] ?? -1}
                    onChange={(e) =>
                      setMapeo((m) => ({
                        ...m,
                        [campo]: e.target.value === '-1' ? undefined : Number(e.target.value),
                      }))
                    }
                  >
                    <option value={-1}>{t('excel.ignorar')}</option>
                    {hoja.encabezados.map((enc, i) => (
                      <option key={i} value={i}>
                        {enc || `${t('excel.columna')} ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="tarjeta" style={{ padding: '10px 14px' }}>
            <div className="mini">
              {t('excel.filasDetectadas', { filas: hoja.filas.length })} ·{' '}
              {t('excel.filasValidas', { validas: resultado.validas.length, conError: resultado.errores.length })}
            </div>
            {resultado.simbolosNuevos.length > 0 && (
              <div className="mini suave" style={{ marginTop: 4 }}>
                {t('excel.activosNuevos', { cantidad: resultado.simbolosNuevos.length })}:{' '}
                {resultado.simbolosNuevos.join(', ')}
              </div>
            )}
            {resultado.errores.length > 0 && (
              <>
                <button className="btn btn-fantasma btn-mini" style={{ marginTop: 6 }} onClick={() => setVerErrores(!verErrores)}>
                  {t('excel.verErrores')}
                </button>
                {verErrores && (
                  <div className="mini suave" style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
                    {resultado.errores.slice(0, 50).map((e) => (
                      <div key={e.fila}>
                        {t('excel.errorFila', { fila: e.fila, error: ETIQUETA_CAMPO[e.error as CampoImport] ?? e.error })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {hoja.filas.length === 0 && <div className="mini suave">{t('excel.sinFilas')}</div>}
          </div>
        </div>
      )}

      {paso === 3 && hecho !== undefined && (
        <p style={{ margin: 0 }} className="positivo">
          ✓ {t('excel.importadas', { filas: hecho })}
        </p>
      )}
    </Modal>
  )
}
