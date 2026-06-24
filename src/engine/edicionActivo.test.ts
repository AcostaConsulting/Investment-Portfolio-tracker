import { describe, expect, it } from 'vitest'
import { editarMetadatosActivo, editarOperacion, eliminarOperacion, type MetadatosEditables } from './edicionActivo'
import { calcularPortafolio } from './portafolio'
import { documentoInicial, type DocumentoStore } from '../state/documento'
import type { Activo, ContextoValuacion, Operacion } from './tipos'

const apple: Activo = {
  id: 'aapl',
  simbolo: 'AAPL',
  nombre: 'Apple',
  clase: 'accion',
  moneda: 'MXN',
  sector: 'technology',
  geografia: 'eua',
}

function doc(activos: Activo[], operaciones: Operacion[] = []): DocumentoStore {
  return {
    ...documentoInicial(),
    activos,
    operaciones,
    historico: [{ fecha: '2026-01-01', valor: 1000 }],
  }
}

function ctx(parcial: Partial<ContextoValuacion> = {}): ContextoValuacion {
  return { monedaBase: 'MXN', hoy: '2026-06-24', precios: {}, tiposCambio: {}, ...parcial }
}

let secuencia = 0
function op(parcial: Partial<Operacion> & Pick<Operacion, 'tipo' | 'fecha'>): Operacion {
  secuencia += 1
  return {
    id: `op-${secuencia}`,
    activoId: 'aapl',
    cantidad: 0,
    precioUnitario: 0,
    moneda: 'MXN',
    tipoCambio: 1,
    ...parcial,
  }
}

describe('editarMetadatosActivo', () => {
  it('edita el sector sin tocar id, simbolo ni clase', () => {
    const d = doc([apple])
    const r = editarMetadatosActivo(d, 'aapl', { sector: 'consumer_staples' })
    const a = r.activos[0]!
    expect(a.sector).toBe('consumer_staples')
    expect(a.id).toBe('aapl')
    expect(a.simbolo).toBe('AAPL')
    expect(a.clase).toBe('accion')
  })

  it('edita nombre, geografia, etiquetas y liquido a la vez', () => {
    const d = doc([apple])
    const r = editarMetadatosActivo(d, 'aapl', {
      nombre: 'Apple Inc.',
      geografia: 'global',
      etiquetaIds: ['e1', 'e2'],
      liquido: false,
    })
    const a = r.activos[0]!
    expect(a.nombre).toBe('Apple Inc.')
    expect(a.geografia).toBe('global')
    expect(a.etiquetaIds).toEqual(['e1', 'e2'])
    expect(a.liquido).toBe(false)
  })

  it('permite limpiar un metadato opcional (sector → sin sector)', () => {
    const d = doc([apple])
    const r = editarMetadatosActivo(d, 'aapl', { sector: undefined })
    expect(r.activos[0]!.sector).toBeUndefined()
  })

  it('ignora intentos de cambiar simbolo o clase aunque vengan en el parche', () => {
    const d = doc([apple])
    const parche = { nombre: 'X', simbolo: 'HACK', clase: 'cripto' } as unknown as MetadatosEditables
    const r = editarMetadatosActivo(d, 'aapl', parche)
    expect(r.activos[0]!.simbolo).toBe('AAPL')
    expect(r.activos[0]!.clase).toBe('accion')
    expect(r.activos[0]!.nombre).toBe('X')
  })

  it('no muta el documento original', () => {
    const d = doc([apple])
    const r = editarMetadatosActivo(d, 'aapl', { sector: 'energy' })
    expect(d.activos[0]!.sector).toBe('technology')
    expect(r).not.toBe(d)
    expect(r.activos).not.toBe(d.activos)
  })

  it('no reescribe el historico al editar metadatos', () => {
    const d = doc([apple])
    const r = editarMetadatosActivo(d, 'aapl', { sector: 'energy' })
    expect(r.historico).toEqual(d.historico)
  })

  it('deja el documento intacto si el activo no existe', () => {
    const d = doc([apple])
    const r = editarMetadatosActivo(d, 'fantasma', { sector: 'energy' })
    expect(r.activos[0]!.sector).toBe('technology')
  })
})

describe('editarOperacion', () => {
  it('editar el precio de una compra recalcula el costo promedio', () => {
    const compra = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const d = doc([apple], [compra])
    const r = editarOperacion(d, { ...compra, precioUnitario: 12 })
    const { posiciones } = calcularPortafolio(r.activos, r.operaciones, ctx())
    expect(posiciones[0]!.precioPromedioBase).toBeCloseTo(12, 6)
    expect(posiciones[0]!.costoBase).toBeCloseTo(1200, 6)
  })

  it('editar el tipo de una operacion (compra → dividendo) cambia el recálculo', () => {
    const c1 = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const c2 = op({ tipo: 'compra', fecha: '2026-02-10', cantidad: 50, precioUnitario: 20 })
    const d = doc([apple], [c1, c2])
    const r = editarOperacion(d, { ...c2, tipo: 'dividendo' })
    const { posiciones } = calcularPortafolio(r.activos, r.operaciones, ctx())
    expect(posiciones[0]!.cantidad).toBe(100) // la 2ª ya no suma unidades
    expect(posiciones[0]!.ingresosBase).toBeCloseTo(1000, 6) // 50·20 como ingreso
  })

  it('una operación con id nuevo se agrega (upsert)', () => {
    const compra = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const d = doc([apple], [compra])
    const nueva = op({ tipo: 'compra', fecha: '2026-03-10', cantidad: 10, precioUnitario: 50 })
    const r = editarOperacion(d, nueva)
    expect(r.operaciones).toHaveLength(2)
  })

  it('no muta el documento original', () => {
    const compra = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const d = doc([apple], [compra])
    const r = editarOperacion(d, { ...compra, precioUnitario: 99 })
    expect(d.operaciones[0]!.precioUnitario).toBe(10)
    expect(r).not.toBe(d)
  })
})

describe('eliminarOperacion', () => {
  it('eliminar una venta restaura la cantidad y borra su P&L realizado', () => {
    const compra = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const venta = op({ tipo: 'venta', fecha: '2026-02-10', cantidad: 40, precioUnitario: 15 })
    const d = doc([apple], [compra, venta])
    const r = eliminarOperacion(d, venta.id)
    const { posiciones } = calcularPortafolio(r.activos, r.operaciones, ctx())
    expect(posiciones[0]!.cantidad).toBe(100)
    expect(posiciones[0]!.realizadoBase).toBe(0)
  })

  it('no muta el documento original', () => {
    const compra = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const venta = op({ tipo: 'venta', fecha: '2026-02-10', cantidad: 40, precioUnitario: 15 })
    const d = doc([apple], [compra, venta])
    const r = eliminarOperacion(d, venta.id)
    expect(d.operaciones).toHaveLength(2)
    expect(r.operaciones).toHaveLength(1)
  })
})

describe('caso borde: la posición llega a cantidad 0', () => {
  it('editar una venta para liquidar toda la tenencia deja la posición en 0 con costo 0', () => {
    const compra = op({ tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 10 })
    const venta = op({ tipo: 'venta', fecha: '2026-02-10', cantidad: 60, precioUnitario: 15 })
    const d = doc([apple], [compra, venta])
    // Edita la venta de 60 → 100 (vende todo).
    const r = editarOperacion(d, { ...venta, cantidad: 100 })
    const { posiciones, totales } = calcularPortafolio(r.activos, r.operaciones, ctx())
    const p = posiciones[0]!
    expect(p.cantidad).toBe(0)
    expect(p.costoBase).toBe(0)
    // realizado = 100·15 − 100·10 = 500, se conserva en los totales.
    expect(p.realizadoBase).toBeCloseTo(500, 6)
    expect(totales.pnlRealizado).toBeCloseTo(500, 6)
  })
})
