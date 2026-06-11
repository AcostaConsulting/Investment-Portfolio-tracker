/**
 * Export a Excel con formato (Pro+): tres hojas — Movimientos, Posiciones
 * y Resumen — con encabezados estilizados, formatos numéricos y autofiltro.
 */

import type ExcelJS from 'exceljs'
import type { TFunction } from 'i18next'
import type { DocumentoStore } from '../../state/documento'
import type { ResultadoPortafolio } from '../../engine/portafolio'
import { compararPorFecha, hoyIso } from '../../engine/fechas'
import { textoABase64 } from '../../servicios/respaldo'

const ROSA = 'FFC40F63'
const PAPEL = 'FFF5EFE3'

function estilizarEncabezado(hoja: ExcelJS.Worksheet): void {
  const fila = hoja.getRow(1)
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROSA } }
  fila.alignment = { vertical: 'middle' }
  fila.height = 22
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
}

function bordear(hoja: ExcelJS.Worksheet): void {
  hoja.eachRow((fila) => {
    fila.eachCell((celda) => {
      celda.border = {
        bottom: { style: 'thin', color: { argb: 'FFDDD3BC' } },
      }
    })
  })
}

export async function exportarExcel(
  doc: DocumentoStore,
  portafolio: ResultadoPortafolio,
  t: TFunction,
): Promise<boolean> {
  // Carga diferida: exceljs pesa ~1MB y solo se necesita aquí.
  const { Workbook } = (await import('exceljs')).default ?? (await import('exceljs'))
  const libro = new Workbook()
  libro.creator = 'Tracker de Portafolio'
  const base = doc.ajustes.monedaBase
  const porActivo = new Map(doc.activos.map((a) => [a.id, a]))

  // ---------- Movimientos ----------
  const hojaOps = libro.addWorksheet(t('movimientos.titulo'))
  hojaOps.columns = [
    { header: t('comunes.fecha'), key: 'fecha', width: 12 },
    { header: t('comunes.simbolo'), key: 'simbolo', width: 12 },
    { header: t('comunes.tipo'), key: 'tipo', width: 12 },
    { header: t('comunes.cantidad'), key: 'cantidad', width: 14, style: { numFmt: '#,##0.########' } },
    { header: t('comunes.precio'), key: 'precio', width: 14, style: { numFmt: '#,##0.00######' } },
    { header: t('comunes.moneda'), key: 'moneda', width: 9 },
    { header: t('formOperacion.tipoCambio', { base }), key: 'tc', width: 12, style: { numFmt: '#,##0.0000' } },
    { header: t('comunes.comision'), key: 'comision', width: 11, style: { numFmt: '#,##0.00' } },
    { header: t('movimientos.importeBase', { moneda: base }), key: 'importe', width: 16, style: { numFmt: '#,##0.00' } },
    { header: t('comunes.nota'), key: 'nota', width: 28 },
  ]
  for (const op of [...doc.operaciones].sort(compararPorFecha)) {
    hojaOps.addRow({
      fecha: op.fecha,
      simbolo: porActivo.get(op.activoId)?.simbolo ?? '?',
      tipo: t(`operaciones.${op.tipo}`),
      cantidad: op.cantidad,
      precio: op.precioUnitario,
      moneda: op.moneda,
      tc: op.tipoCambio,
      comision: op.comision ?? 0,
      importe: op.cantidad * op.precioUnitario * op.tipoCambio,
      nota: op.nota ?? '',
    })
  }
  estilizarEncabezado(hojaOps)
  bordear(hojaOps)
  hojaOps.autoFilter = { from: 'A1', to: 'J1' }

  // ---------- Posiciones ----------
  const hojaPos = libro.addWorksheet(t('posiciones.titulo'))
  hojaPos.columns = [
    { header: t('comunes.simbolo'), key: 'simbolo', width: 12 },
    { header: t('comunes.nombre'), key: 'nombre', width: 24 },
    { header: t('comunes.clase'), key: 'clase', width: 12 },
    { header: t('comunes.cantidad'), key: 'cantidad', width: 14, style: { numFmt: '#,##0.########' } },
    { header: `${t('posiciones.precioPromedio')} (${base})`, key: 'pp', width: 16, style: { numFmt: '#,##0.00' } },
    { header: `${t('posiciones.valorActual')} (${base})`, key: 'valor', width: 16, style: { numFmt: '#,##0.00' } },
    { header: `${t('posiciones.pnl')} (${base})`, key: 'pnl', width: 14, style: { numFmt: '#,##0.00' } },
    { header: t('posiciones.rendimiento'), key: 'rend', width: 10, style: { numFmt: '0.00"%"' } },
  ]
  for (const p of portafolio.posiciones.filter((p) => p.cantidad > 0)) {
    hojaPos.addRow({
      simbolo: p.activo.simbolo,
      nombre: p.activo.nombre,
      clase: t(`clases.${p.activo.clase}`),
      cantidad: p.cantidad,
      pp: p.precioPromedioBase ?? 0,
      valor: p.valorBase ?? 0,
      pnl: p.pnlNoRealizadoBase ?? 0,
      rend: p.rendimientoPct ?? 0,
    })
  }
  estilizarEncabezado(hojaPos)
  bordear(hojaPos)

  // ---------- Resumen ----------
  const hojaRes = libro.addWorksheet(t('nav.resumen'))
  hojaRes.columns = [
    { header: '', key: 'k', width: 28 },
    { header: `${hoyIso()}`, key: 'v', width: 18, style: { numFmt: '#,##0.00' } },
  ]
  const { totales } = portafolio
  const filas: [string, number][] = [
    [t('resumen.valorTotal'), totales.valorTotal],
    [t('resumen.costoTotal'), totales.costoTotal],
    [t('resumen.pnlNoRealizado'), totales.pnlNoRealizado],
    [t('resumen.pnlRealizado'), totales.pnlRealizado],
    [t('resumen.ingresos'), totales.ingresos],
    [t('analisis.comisionesTotal'), totales.comisiones],
    [t('resumen.gananciaTotal'), totales.gananciaTotal],
  ]
  for (const [k, v] of filas) hojaRes.addRow({ k, v })
  hojaRes.getColumn(1).font = { bold: true }
  hojaRes.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAPEL } }

  // ---------- guardar ----------
  const buffer = await libro.xlsx.writeBuffer()
  const bytes = new Uint8Array(buffer)
  let binario = ''
  const TROZO = 0x8000
  for (let i = 0; i < bytes.length; i += TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }
  const r = await window.api?.dialogo.guardar({
    sugerido: `tracker-portafolio-${hoyIso()}.xlsx`,
    filtros: [{ nombre: 'Excel', extensiones: ['xlsx'] }],
    contenidoBase64: btoa(binario),
  })
  return r?.guardado ?? false
}

// textoABase64 se re-exporta para quien ya importe de aquí.
export { textoABase64 }
