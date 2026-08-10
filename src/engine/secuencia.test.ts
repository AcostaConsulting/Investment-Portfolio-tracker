/**
 * Pruebas del orden intradía explícito — escritas ANTES de la implementación y
 * corridas en rojo (§13.3).
 *
 * El bug (AUDITORIA-ROBUSTEZ.md #6): `compararPorFecha` desempataba por `id`, y
 * el `id` es un `crypto.randomUUID()` generado al guardar. El orden era
 * determinista por documento pero **no significaba nada**: lo decidió un volado.
 * Medido en §21.1: las mismas 3 operaciones de un día dieron un realizado de
 * −500, 0 o +1500 según qué UUID tocó.
 */

import { describe, expect, it } from 'vitest'
import { compararPorFecha } from './fechas'
import { asignarSecuencias, moverEnSuDia, siguienteSecuencia } from './secuencia'
import type { Operacion } from './tipos'

const op = (id: string, fecha: string, secuencia?: number, activoId = 'a1'): Operacion => ({
  id,
  activoId,
  tipo: 'compra',
  fecha,
  cantidad: 1,
  precioUnitario: 100,
  moneda: 'MXN',
  tipoCambio: 1,
  ...(secuencia !== undefined ? { secuencia } : {}),
})

const ids = (ops: Operacion[]) => ops.map((o) => o.id)

describe('compararPorFecha — desempata por secuencia, no por el UUID', () => {
  it('la fecha manda por encima de todo', () => {
    const ops = [op('b', '2026-05-05', 1), op('a', '2026-01-01', 9)]
    expect(ids([...ops].sort(compararPorFecha))).toEqual(['a', 'b'])
  })

  it('🔴 el mismo día, gana la secuencia aunque el id diga lo contrario', () => {
    // 'aaa' < 'zzz' por id, pero la secuencia dice que 'zzz' va primero.
    const ops = [op('aaa', '2026-05-05', 2), op('zzz', '2026-05-05', 1)]
    expect(ids([...ops].sort(compararPorFecha))).toEqual(['zzz', 'aaa'])
  })

  it('sin secuencia en ninguna, se conserva el desempate viejo por id', () => {
    // Compatibilidad: un documento sin migrar sigue ordenándose igual que antes.
    const ops = [op('zzz', '2026-05-05'), op('aaa', '2026-05-05')]
    expect(ids([...ops].sort(compararPorFecha))).toEqual(['aaa', 'zzz'])
  })

  it('si solo una la tiene, cae al desempate viejo (no se inventa un orden)', () => {
    const ops = [op('zzz', '2026-05-05', 1), op('aaa', '2026-05-05')]
    expect(ids([...ops].sort(compararPorFecha))).toEqual(['aaa', 'zzz'])
  })

  it('secuencias iguales caen al id: nunca queda indefinido', () => {
    const ops = [op('zzz', '2026-05-05', 3), op('aaa', '2026-05-05', 3)]
    expect(ids([...ops].sort(compararPorFecha))).toEqual(['aaa', 'zzz'])
  })
})

describe('asignarSecuencias — la migración NO puede cambiar el orden', () => {
  it('deriva la secuencia del orden que hoy decide el UUID', () => {
    const ops = [op('ccc', '2026-05-05'), op('aaa', '2026-05-05'), op('bbb', '2026-01-01')]
    const migradas = asignarSecuencias(ops)
    // El orden efectivo tras migrar es idéntico al de antes.
    expect(ids([...migradas].sort(compararPorFecha))).toEqual(ids([...ops].sort(compararPorFecha)))
  })

  it('todas quedan con una secuencia, única y creciente', () => {
    const ops = [op('c', '2026-05-05'), op('a', '2026-05-05'), op('b', '2026-01-01')]
    const secs = asignarSecuencias(ops).map((o) => o.secuencia!)
    expect(secs.every((s) => Number.isInteger(s))).toBe(true)
    expect(new Set(secs).size).toBe(secs.length)
  })

  it('es idempotente: migrar dos veces no mueve nada', () => {
    const ops = [op('c', '2026-05-05'), op('a', '2026-05-05'), op('b', '2026-01-01')]
    const una = asignarSecuencias(ops)
    const dos = asignarSecuencias(una)
    expect(dos).toEqual(una)
  })

  it('🔑 respeta un orden que el usuario ya reordenó a mano', () => {
    // Si todas tienen secuencia, no se toca nada aunque contradiga a los ids.
    const ops = [op('aaa', '2026-05-05', 2), op('zzz', '2026-05-05', 1)]
    expect(asignarSecuencias(ops)).toEqual(ops)
  })

  it('con la mitad sin secuencia, renumera todo conservando el orden efectivo', () => {
    const ops = [op('zzz', '2026-05-05', 1), op('aaa', '2026-05-05')]
    const antes = ids([...ops].sort(compararPorFecha))
    const migradas = asignarSecuencias(ops)
    expect(migradas.every((o) => o.secuencia !== undefined)).toBe(true)
    expect(ids([...migradas].sort(compararPorFecha))).toEqual(antes)
  })

  it('sin operaciones no truena', () => {
    expect(asignarSecuencias([])).toEqual([])
  })
})

describe('siguienteSecuencia — lo nuevo va al final', () => {
  it('parte de 1 en un documento vacío', () => {
    expect(siguienteSecuencia([])).toBe(1)
  })

  it('es el máximo + 1, aunque haya huecos', () => {
    expect(siguienteSecuencia([op('a', '2026-01-01', 3), op('b', '2026-01-01', 41)])).toBe(42)
  })

  it('ignora las que no tienen secuencia', () => {
    expect(siguienteSecuencia([op('a', '2026-01-01'), op('b', '2026-01-01', 7)])).toBe(8)
  })
})

describe('moverEnSuDia — reordenar dentro del mismo activo y día', () => {
  const dia = [
    op('p', '2026-05-05', 1),
    op('q', '2026-05-05', 2),
    op('r', '2026-05-05', 3),
    op('otro', '2026-05-05', 4, 'a2'), // otro activo: no participa
    op('ayer', '2026-05-04', 0),
  ]

  const ordenDe = (ops: Operacion[], activoId = 'a1') =>
    ids(ops.filter((o) => o.activoId === activoId && o.fecha === '2026-05-05').sort(compararPorFecha))

  it('mover hacia arriba intercambia con la anterior', () => {
    expect(ordenDe(moverEnSuDia(dia, 'q', -1))).toEqual(['q', 'p', 'r'])
  })

  it('mover hacia abajo intercambia con la siguiente', () => {
    expect(ordenDe(moverEnSuDia(dia, 'q', 1))).toEqual(['p', 'r', 'q'])
  })

  it('en los extremos no hace nada', () => {
    expect(ordenDe(moverEnSuDia(dia, 'p', -1))).toEqual(['p', 'q', 'r'])
    expect(ordenDe(moverEnSuDia(dia, 'r', 1))).toEqual(['p', 'q', 'r'])
  })

  it('no toca otros activos ni otros días', () => {
    const movidas = moverEnSuDia(dia, 'q', -1)
    expect(movidas.find((o) => o.id === 'otro')!.secuencia).toBe(4)
    expect(movidas.find((o) => o.id === 'ayer')!.secuencia).toBe(0)
  })

  it('un id que no existe se ignora', () => {
    expect(moverEnSuDia(dia, 'no-existe', 1)).toEqual(dia)
  })

  it('no muta el arreglo original', () => {
    const copia = structuredClone(dia)
    moverEnSuDia(dia, 'q', -1)
    expect(dia).toEqual(copia)
  })
})
