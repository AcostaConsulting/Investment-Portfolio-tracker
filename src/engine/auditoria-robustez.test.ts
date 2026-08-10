/**
 * INSTRUMENTO DE AUDITORÍA — hallazgos de robustez pendientes.
 *
 * ⚠️ Cambió de forma el 10 ago (Fase A). Antes, las pruebas `[HALLAZGO]`
 * afirmaban el comportamiento **defectuoso**, así que el verde certificaba que
 * el bug seguía ahí — justo lo contrario de lo que §12.6 pide de una prueba.
 *
 * Ahora cada hallazgo pendiente está escrito con el valor **CORRECTO** y
 * marcado `it.fails()`: hoy pasa porque la aserción falla, y **el día que
 * alguien arregle el bug, la prueba se pondrá en rojo pidiendo que se le quite
 * el `.fails`**. Arreglar cada uno es quitar una palabra.
 *
 * Convención:
 * - `[PENDIENTE #n]` + `it.fails` → bug abierto, con su número en
 *   AUDITORIA-ROBUSTEZ.md. El cuerpo dice qué DEBERÍA pasar.
 * - `[INVARIANTE]` → algo que debe cumplirse siempre y hoy se cumple.
 * - `[MEDICIÓN]` → número que se quiso dejar registrado.
 *
 * Los hallazgos de persistencia (#1, #2, #3, #7, #8, #9, #20) ya NO están aquí:
 * se arreglaron en Fase A y sus candados viven en `electron/main/almacen.test.ts`
 * y `src/state/documento.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import { calcularPortafolio } from './portafolio'
import { recorrerCosteo } from './costeo'
import { eventosFiscales, resumirEventos } from './fiscal'
import { valuarRentaFija } from './rentaFija'
import { redondear } from './dinero'
import type { Activo, Advertencia, ContextoValuacion, Operacion, TipoOperacion } from './tipos'

// ---------------------------------------------------------------- utilidades

/** PRNG determinista (LCG de Numerical Recipes) — sin dependencias nuevas. */
function prng(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 4294967296
  }
}

const ACCION: Activo = { id: 'a1', simbolo: 'AAA', nombre: 'Activo A', clase: 'accion', moneda: 'MXN' }

function ctx(over: Partial<ContextoValuacion> = {}): ContextoValuacion {
  return {
    monedaBase: 'MXN',
    hoy: '2026-08-09',
    precios: {},
    tiposCambio: {},
    ...over,
  }
}

function op(p: Partial<Operacion> & { tipo: TipoOperacion; id: string }): Operacion {
  return {
    activoId: 'a1',
    fecha: '2026-01-01',
    cantidad: 0,
    precioUnitario: 0,
    moneda: 'MXN',
    tipoCambio: 1,
    ...p,
  }
}

// ============================================================ B1 · INVARIANTES

describe('B1 · property tests sobre el motor', () => {
  it('[INVARIANTE] tras cualquier secuencia aleatoria: cantidad >= 0 y costo >= 0', () => {
    const tipos: TipoOperacion[] = ['compra', 'venta', 'dividendo', 'staking', 'ajuste', 'interes']
    let peorCantidad = 0
    let peorCosto = 0
    for (let semilla = 1; semilla <= 300; semilla++) {
      const r = prng(semilla)
      const ops: Operacion[] = []
      const n = 3 + Math.floor(r() * 25)
      for (let i = 0; i < n; i++) {
        const tipo = tipos[Math.floor(r() * tipos.length)]!
        const dia = String(1 + Math.floor(r() * 28)).padStart(2, '0')
        ops.push(
          op({
            id: `op${i}`,
            tipo,
            fecha: `2026-0${1 + Math.floor(r() * 9)}-${dia}`,
            cantidad: tipo === 'ajuste' ? (r() < 0.5 ? -1 : 1) * r() * 10 : r() * 50,
            precioUnitario: r() * 500,
            comision: r() < 0.3 ? r() * 20 : undefined,
            importeEfectivo: tipo === 'dividendo' || tipo === 'interes' ? r() * 300 : undefined,
          }),
        )
      }
      const adv: Advertencia[] = []
      const { estado } = recorrerCosteo(ACCION, ops, adv)
      peorCantidad = Math.min(peorCantidad, estado.cantidad)
      peorCosto = Math.min(peorCosto, estado.costoBase)
    }
    expect(peorCantidad).toBeGreaterThanOrEqual(-1e-9)
    expect(peorCosto).toBeGreaterThanOrEqual(-1e-9)
  })

  it('[INVARIANTE] la suma de valorBase de las posiciones abiertas es valorTotal', () => {
    for (let semilla = 1; semilla <= 100; semilla++) {
      const r = prng(semilla)
      const activos: Activo[] = []
      const ops: Operacion[] = []
      const precios: Record<string, { precio: number; moneda: string }> = {}
      const nA = 1 + Math.floor(r() * 6)
      for (let a = 0; a < nA; a++) {
        const id = `a${a}`
        const clase = (['accion', 'cripto'] as const)[Math.floor(r() * 2)]!
        activos.push({ id, simbolo: `S${a}`, nombre: `N${a}`, clase, moneda: 'MXN' })
        precios[id] = { precio: r() * 1000, moneda: 'MXN' }
        const nO = 1 + Math.floor(r() * 6)
        for (let o = 0; o < nO; o++) {
          ops.push(
            op({
              id: `a${a}o${o}`,
              activoId: id,
              tipo: r() < 0.75 ? 'compra' : 'venta',
              fecha: `2026-0${1 + Math.floor(r() * 8)}-15`,
              cantidad: 1 + r() * 20,
              precioUnitario: 1 + r() * 500,
            }),
          )
        }
      }
      const res = calcularPortafolio(activos, ops, ctx({ precios }))
      const suma = res.posiciones
        .filter((p) => p.cantidad > 0)
        .reduce((s, p) => s + (p.valorBase ?? 0), 0)
      expect(redondear(suma, 2)).toBeCloseTo(res.totales.valorTotal, 2)
    }
  })

  it('[MEDICIÓN] tolerancia real con la que pesoPct y porClase suman 100', () => {
    let peorPeso = 0
    let peorClase = 0
    for (let semilla = 1; semilla <= 200; semilla++) {
      const r = prng(semilla)
      const activos: Activo[] = []
      const ops: Operacion[] = []
      const precios: Record<string, { precio: number; moneda: string }> = {}
      const nA = 2 + Math.floor(r() * 10)
      for (let a = 0; a < nA; a++) {
        const id = `a${a}`
        const clase = (['accion', 'cripto'] as const)[Math.floor(r() * 2)]!
        activos.push({ id, simbolo: `S${a}`, nombre: `N${a}`, clase, moneda: 'MXN' })
        precios[id] = { precio: 0.01 + r() * 3000, moneda: 'MXN' }
        ops.push(
          op({ id: `a${a}o`, activoId: id, tipo: 'compra', cantidad: 0.5 + r() * 40, precioUnitario: 1 + r() * 900 }),
        )
      }
      const res = calcularPortafolio(activos, ops, ctx({ precios }))
      const sumaPesos = res.posiciones.reduce((s, p) => s + (p.pesoPct ?? 0), 0)
      const sumaClases = Object.values(res.totales.porClase).reduce((s, c) => s + c.pct, 0)
      if (res.totales.valorTotal > 0) {
        peorPeso = Math.max(peorPeso, Math.abs(100 - sumaPesos))
        peorClase = Math.max(peorClase, Math.abs(100 - sumaClases))
      }
    }
    // Documenta la desviación máxima observada; no hay tolerancia declarada en
    // el código, así que esto ES la tolerancia.
    console.log(`[peso] desviación máx de 100: ${peorPeso.toFixed(4)} pp`)
    console.log(`[clase] desviación máx de 100: ${peorClase.toFixed(4)} pp`)
    expect(peorPeso).toBeLessThan(1)
    expect(peorClase).toBeLessThan(1)
  })
})

// ================================================== B2 · SOBREVENTA Y CEROS

describe('B2 · sobreventa y ceros', () => {
  it('[INVARIANTE] vender más de lo que se tiene se acota y ADVIERTE', () => {
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(
      ACCION,
      [
        op({ id: '1', tipo: 'compra', fecha: '2026-01-01', cantidad: 10, precioUnitario: 100 }),
        op({ id: '2', tipo: 'venta', fecha: '2026-02-01', cantidad: 1000, precioUnitario: 150 }),
      ],
      adv,
    )
    expect(estado.cantidad).toBe(0)
    expect(adv.map((a) => a.codigo)).toContain('venta_excede_tenencia')
  })

  it('[INVARIANTE] vender a cero y recomprar NO arrastra el costo viejo', () => {
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(
      ACCION,
      [
        op({ id: '1', tipo: 'compra', fecha: '2026-01-01', cantidad: 10, precioUnitario: 100 }),
        op({ id: '2', tipo: 'venta', fecha: '2026-02-01', cantidad: 10, precioUnitario: 150 }),
        op({ id: '3', tipo: 'compra', fecha: '2026-03-01', cantidad: 5, precioUnitario: 20 }),
      ],
      adv,
    )
    expect(estado.cantidad).toBeCloseTo(5, 9)
    expect(estado.costoBase).toBeCloseTo(100, 9) // 5 × 20, sin residuo del lote viejo
    expect(estado.realizadoBase).toBeCloseTo(500, 9)
  })

  it('[INVARIANTE] posición en cero no produce división por cero en el portafolio', () => {
    const res = calcularPortafolio(
      [ACCION],
      [
        op({ id: '1', tipo: 'compra', fecha: '2026-01-01', cantidad: 10, precioUnitario: 100 }),
        op({ id: '2', tipo: 'venta', fecha: '2026-02-01', cantidad: 10, precioUnitario: 150 }),
      ],
      ctx({ precios: { a1: { precio: 200, moneda: 'MXN' } } }),
    )
    const p = res.posiciones[0]!
    expect(p.cantidad).toBe(0)
    expect(Number.isFinite(res.totales.valorTotal)).toBe(true)
    expect(Number.isFinite(res.totales.rendimientoPct)).toBe(true)
    expect(p.precioPromedioBase).toBeUndefined()
  })
})

// ================================================= B3 · PUNTO FLOTANTE

describe('B3 · deriva de punto flotante', () => {
  it('[MEDICIÓN] 500 compras pequeñas contra el cálculo exacto en enteros', () => {
    const ops: Operacion[] = []
    for (let i = 0; i < 500; i++) {
      ops.push(op({ id: `c${i}`, tipo: 'compra', fecha: '2026-01-01', cantidad: 1, precioUnitario: 0.07 }))
    }
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(ACCION, ops, adv)
    const exacto = (500 * 7) / 100 // 35 exacto en decimal
    const deriva = Math.abs(estado.costoBase - exacto)
    console.log(`[float] costo=${estado.costoBase} exacto=${exacto} deriva=${deriva.toExponential(3)}`)
    expect(deriva).toBeLessThan(0.005) // menos de medio centavo
  })

  it('[MEDICIÓN] 1000 operaciones mixtas: deriva acumulada del realizado', () => {
    const r = prng(42)
    const ops: Operacion[] = []
    let esperadoCantidad = 0
    for (let i = 0; i < 1000; i++) {
      const cantidad = Math.round(r() * 1000) / 100
      ops.push(op({ id: `c${i}`, tipo: 'compra', fecha: '2026-01-01', cantidad, precioUnitario: 10 }))
      esperadoCantidad += cantidad
    }
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(ACCION, ops, adv)
    const deriva = Math.abs(estado.cantidad - esperadoCantidad)
    console.log(`[float] deriva de cantidad tras 1000 ops: ${deriva.toExponential(3)}`)
    expect(deriva).toBeLessThan(1e-6)
  })
})

// ================================================= B4 · VALORES EXTREMOS

describe('B4 · valores extremos', () => {
  it('[INVARIANTE] 0.00000001 BTC sobrevive el recorrido sin colapsar a cero', () => {
    const btc: Activo = { id: 'a1', simbolo: 'BTC', nombre: 'Bitcoin', clase: 'cripto', moneda: 'MXN' }
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(
      btc,
      [op({ id: '1', tipo: 'compra', cantidad: 0.00000001, precioUnitario: 2_000_000 })],
      adv,
    )
    expect(estado.cantidad).toBe(0.00000001)
    expect(estado.costoBase).toBeCloseTo(0.02, 9)
  })

  it.fails('[PENDIENTE #22] una posición comprada de verdad no debería borrarse por diminuta', () => {
    // El limpiador de residuos de punto flotante no distingue "residuo" de
    // "posición real diminuta". 1 satoshi = 1e-8 sobrevive; 1e-10 no.
    const btc: Activo = { id: 'a1', simbolo: 'BTC', nombre: 'Bitcoin', clase: 'cripto', moneda: 'MXN' }
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(
      btc,
      [op({ id: '1', tipo: 'compra', cantidad: 1e-10, precioUnitario: 2_000_000 })],
      adv,
    )
    expect(estado.cantidad).toBe(1e-10)
    expect(estado.costoBase).toBeCloseTo(0.0002, 10)
  })

  it('[MEDICIÓN] 1e12 unidades no pierde precisión en el costo', () => {
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(ACCION, [op({ id: '1', tipo: 'compra', cantidad: 1e12, precioUnitario: 1 })], adv)
    expect(estado.costoBase).toBe(1e12)
  })

  it.fails('[PENDIENTE #15] un precio NEGATIVO debería advertirse, no aceptarse callando', () => {
    const adv: Advertencia[] = []
    recorrerCosteo(ACCION, [op({ id: '1', tipo: 'compra', cantidad: 10, precioUnitario: -100 })], adv)
    expect(adv.length).toBeGreaterThan(0)
  })

  it.fails('[PENDIENTE #16] una comisión mayor que el importe debería advertirse', () => {
    // Es la misma forma del bug de §16.2 que sí llegó a publicarse: un ingreso
    // que sale negativo porque la comisión se resta de un bruto insuficiente.
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(
      ACCION,
      [op({ id: '1', tipo: 'dividendo', importeEfectivo: 10, comision: 500 })],
      adv,
    )
    expect(estado.ingresosBase).toBe(-490) // el número es el que es…
    expect(adv.length).toBeGreaterThan(0) // …pero el usuario debería enterarse
  })

  it('[INVARIANTE] el motor SÍ advierte cuando el tipo de cambio es 0 o negativo', () => {
    // El motor cumple; lo que falta es que alguna pantalla enseñe la
    // advertencia — ése es el hallazgo #11 y vive en la UI, no aquí.
    const adv: Advertencia[] = []
    const { estado } = recorrerCosteo(
      ACCION,
      [op({ id: '1', tipo: 'compra', cantidad: 1, precioUnitario: 100, moneda: 'USD', tipoCambio: 0 })],
      adv,
    )
    expect(estado.costoBase).toBe(100) // cae a 1:1
    expect(adv[0]?.codigo).toBe('sin_tipo_cambio')
  })
})

// ============================================ B5 · ORDEN INTRADÍA (UUID)

describe('B5 · orden intradía decidido por UUID aleatorio', () => {
  it('[MEDICIÓN] el mismo día, compra y venta: el orden cambia el P&L REALIZADO', () => {
    // Mismas tres operaciones, mismo día. Lo único que cambia es el `id`, que
    // en producción es crypto.randomUUID() — o sea, azar.
    const hacer = (ids: [string, string, string]) =>
      recorrerCosteo(
        ACCION,
        [
          op({ id: ids[0], tipo: 'compra', fecha: '2026-05-04', cantidad: 10, precioUnitario: 100 }),
          op({ id: ids[1], tipo: 'compra', fecha: '2026-05-04', cantidad: 10, precioUnitario: 300 }),
          op({ id: ids[2], tipo: 'venta', fecha: '2026-05-04', cantidad: 10, precioUnitario: 250 }),
        ],
        [],
      ).estado

    // Orden A: las dos compras antes de la venta (promedio 200 → +500)
    const a = hacer(['aaa', 'bbb', 'zzz'])
    // Orden B: la venta entre las dos compras (promedio 100 → +1500)
    const b = hacer(['aaa', 'zzz', 'bbb'])

    expect(a.realizadoBase).toBeCloseTo(500, 6)
    expect(b.realizadoBase).toBeCloseTo(1500, 6)
    const diferencia = Math.abs(a.realizadoBase - b.realizadoBase)
    console.log(`[orden intradía] mismo documento, mismo día → realizado ${a.realizadoBase} vs ${b.realizadoBase}`)
    console.log(`[orden intradía] diferencia en la ganancia declarable: $${diferencia.toFixed(2)}`)
    expect(diferencia).toBeGreaterThan(0)
  })

  it.fails('[PENDIENTE #6] la ganancia declarada NO debería depender del UUID: 1000 sorteos', () => {
    // Simula lo que realmente pasa: tres operaciones del mismo día cuyos ids
    // son UUID v4. Se mide la dispersión del número que va al reporte fiscal.
    const resultados = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const ids = [`${i}-a`, `${i}-b`, `${i}-c`]
      // baraja determinista por semilla
      const r = prng(i + 1)
      for (let j = ids.length - 1; j > 0; j--) {
        const k = Math.floor(r() * (j + 1))
        ;[ids[j], ids[k]] = [ids[k]!, ids[j]!]
      }
      const { estado } = recorrerCosteo(
        ACCION,
        [
          op({ id: ids[0]!, tipo: 'compra', fecha: '2026-05-04', cantidad: 10, precioUnitario: 100 }),
          op({ id: ids[1]!, tipo: 'compra', fecha: '2026-05-04', cantidad: 10, precioUnitario: 300 }),
          op({ id: ids[2]!, tipo: 'venta', fecha: '2026-05-04', cantidad: 10, precioUnitario: 250 }),
        ],
        [],
      )
      resultados.add(redondear(estado.realizadoBase, 2))
    }
    console.log(`[orden intradía] valores distintos de realizado observados: ${[...resultados].sort((x, y) => x - y).join(', ')}`)
    // Con un orden intradía determinista (campo `secuencia`, §15.8 paso 2) las
    // 1000 barajas darían UN solo resultado. Hoy dan tres: −500, 0 y +1500.
    expect(resultados.size).toBe(1)
  })
})

// ================================================= B7 · FECHAS LÍMITE

describe('B7 · fechas límite', () => {
  it('[INVARIANTE] 29 de febrero bisiesto se acepta y cuenta bien', () => {
    const v = valuarRentaFija(
      { instrumento: 'cetes', tasaAnual: 10, fechaInicio: '2028-02-28', fechaVencimiento: '2028-03-01' },
      { cantidad: 1, costoNativo: 1000 },
      '2028-03-01',
    )
    expect(v.diasPlazo).toBe(2) // 28-feb → 29-feb → 1-mar
  })

  it.fails('[PENDIENTE #17] un vencimiento anterior a la compra no debería devengar interés NEGATIVO', () => {
    const v = valuarRentaFija(
      { instrumento: 'cetes', tasaAnual: 10, fechaInicio: '2026-06-01', fechaVencimiento: '2026-01-01' },
      { cantidad: 1, costoNativo: 1000 },
      '2026-08-09',
    )
    console.log(`[RF] plazo=${v.diasPlazo} transcurridos=${v.diasTranscurridos} interés=${v.interesBrutoDevengado}`)
    // Lo correcto: días transcurridos nunca negativos y, por tanto, interés ≥ 0.
    expect(v.diasTranscurridos).toBeGreaterThanOrEqual(0)
    expect(v.interesBrutoDevengado).toBeGreaterThanOrEqual(0)
  })

  it('[INVARIANTE] instrumento vencido DEJA de devengar (no crece al infinito)', () => {
    const detalle = {
      instrumento: 'cetes' as const,
      tasaAnual: 10,
      fechaInicio: '2020-01-01',
      fechaVencimiento: '2020-04-01',
    }
    const alVencer = valuarRentaFija(detalle, { cantidad: 1, costoNativo: 1000 }, '2020-04-01')
    const seisAniosDespues = valuarRentaFija(detalle, { cantidad: 1, costoNativo: 1000 }, '2026-08-09')
    expect(seisAniosDespues.interesBrutoDevengado).toBeCloseTo(alVencer.interesBrutoDevengado, 9)
  })

  it('[INVARIANTE] una cuenta de ahorro abierta sigue devengando ISR, y eso es correcto', () => {
    // ⚠️ CORRECCIÓN a la auditoría: se listó como hallazgo #18 ("devenga ISR
    // para siempre"), pero `ahorro` NO tiene vencimiento — una cuenta abierta
    // sí sigue generando retención año con año. El comportamiento es correcto y
    // el hallazgo #18 queda retirado. Se conserva la prueba como candado.
    const detalle = { instrumento: 'ahorro' as const, tasaAnual: 10, fechaInicio: '2020-01-01' }
    const a = valuarRentaFija(detalle, { cantidad: 1, costoNativo: 1000 }, '2021-01-01')
    const b = valuarRentaFija(detalle, { cantidad: 1, costoNativo: 1000 }, '2026-01-01')
    expect(b.isrEstimadoDevengado).toBeGreaterThan(a.isrEstimadoDevengado)
    console.log(`[RF ahorro] ISR 1 año=${a.isrEstimadoDevengado.toFixed(2)} · 6 años=${b.isrEstimadoDevengado.toFixed(2)}`)
  })

  it('[INVARIANTE] plazo de 0 días: no truena y el interés al vencimiento es 0', () => {
    const v = valuarRentaFija(
      { instrumento: 'cetes', tasaAnual: 10, fechaInicio: '2026-06-01', fechaVencimiento: '2026-06-01' },
      { cantidad: 1, costoNativo: 1000 },
      '2026-06-01',
    )
    expect(v.diasPlazo).toBe(0)
    expect(v.interesBrutoAlVencimiento).toBe(0)
    expect(v.vencido).toBe(true)
  })

  it.fails('[PENDIENTE #12] un UDIBONO sin dato de UDI no debería reportar UDIs como si fueran pesos', () => {
    const v = valuarRentaFija(
      { instrumento: 'udibono', tasaAnual: 4, fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01', valorNominal: 100 },
      { cantidad: 10, costoNativo: 10000 },
      '2026-08-09',
    )
    console.log(`[UDIBONO sin UDI] interés reportado (en UDIs, mostrado como MXN): ${v.interesBrutoDevengado.toFixed(4)}`)
    // Lo correcto sería no dar un número convertible a pesos sin saber la UDI:
    // o 0, o una señal. Hoy devuelve el interés en UDIs y la UI lo rotula MXN.
    expect(v.interesBrutoDevengado).toBe(0)
  })
})

// ==================================== B8 · RENTA FIJA: DOS COMPRAS (§17.3)

describe('B8 · dos compras del mismo instrumento de renta fija (§17.3)', () => {
  const rf: Activo = {
    id: 'rf1',
    simbolo: 'CETES-91',
    nombre: 'CETES 91 días',
    clase: 'renta_fija',
    moneda: 'MXN',
    rentaFija: {
      instrumento: 'cetes',
      tasaAnual: 10,
      fechaInicio: '2026-01-01',
      fechaVencimiento: '2026-04-01',
    },
  }

  it.fails('[PENDIENTE #10] la 2ª compra debería devengar desde SU fecha, no desde la 1ª', () => {
    const hoy = '2026-04-01'
    // Realidad: 10,000 el 1-ene (90 días) + 10,000 el 1-mar (31 días).
    const correcto =
      10000 * 0.1 * (90 / 360) + // 250.00
      10000 * 0.1 * (31 / 360) //  86.11

    const res = calcularPortafolio(
      [rf],
      [
        op({ id: '1', activoId: 'rf1', tipo: 'compra', fecha: '2026-01-01', cantidad: 1, precioUnitario: 10000 }),
        op({ id: '2', activoId: 'rf1', tipo: 'compra', fecha: '2026-03-01', cantidad: 1, precioUnitario: 10000 }),
      ],
      ctx({ hoy, tiposCambio: {} }),
    )
    const app = res.posiciones[0]!.rentaFija!.interesBrutoDevengado

    const sobreestimacion = app - correcto
    console.log(`[RF 2 compras] la app devenga: $${app.toFixed(2)}`)
    console.log(`[RF 2 compras] lo correcto:    $${correcto.toFixed(2)}`)
    console.log(`[RF 2 compras] SOBREESTIMA:    $${sobreestimacion.toFixed(2)} (${((sobreestimacion / correcto) * 100).toFixed(1)}%)`)

    expect(correcto).toBeCloseTo(336.11, 2)
    // Lo correcto: la app debería devengar 336.11, no 500. Sobreestima 48.8%.
    expect(app).toBeCloseTo(correcto, 2)
    expect(sobreestimacion).toBe(0)
  })

  it.fails('[PENDIENTE #10] el mismo error no debería llegar al reporte FISCAL', () => {
    const eventos = eventosFiscales(
      [rf],
      [
        op({ id: '1', activoId: 'rf1', tipo: 'compra', fecha: '2026-01-01', cantidad: 1, precioUnitario: 10000 }),
        op({ id: '2', activoId: 'rf1', tipo: 'compra', fecha: '2026-03-01', cantidad: 1, precioUnitario: 10000 }),
      ],
      2026,
      '2026-04-01',
    )
    const devengo = eventos.find((e) => e.tipo === 'interes_devengado_rf')!
    console.log(`[RF 2 compras · fiscal] interés devengado reportado: $${devengo.montoBase.toFixed(2)}`)
    expect(devengo.montoBase).toBeCloseTo(336.11, 2)
  })
})

// ============================ B8-bis · AÑO FISCAL PASADO Y POSICIÓN ACTUAL

describe('B8-bis · el devengo de RF de un año pasado usa la posición de HOY', () => {
  const rf: Activo = {
    id: 'rf1',
    simbolo: 'PAGARE',
    nombre: 'Pagaré',
    clase: 'renta_fija',
    moneda: 'MXN',
    rentaFija: { instrumento: 'pagare', tasaAnual: 12, fechaInicio: '2024-01-01' },
  }

  it.fails('[PENDIENTE #5] comprar más en 2026 NO debería cambiar el interés declarado de 2024', () => {
    const base = [
      op({ id: '1', activoId: 'rf1', tipo: 'compra', fecha: '2024-01-01', cantidad: 1, precioUnitario: 10000 }),
    ]
    const conCompraNueva = [
      ...base,
      op({ id: '2', activoId: 'rf1', tipo: 'compra', fecha: '2026-06-01', cantidad: 1, precioUnitario: 90000 }),
    ]

    const a = resumirEventos(eventosFiscales([rf], base, 2024, '2026-08-09')).interesesDevengadosRf
    const b = resumirEventos(eventosFiscales([rf], conCompraNueva, 2024, '2026-08-09')).interesesDevengadosRf

    console.log(`[fiscal 2024] sin la compra de 2026: $${a.toFixed(2)}`)
    console.log(`[fiscal 2024] CON la compra de 2026: $${b.toFixed(2)}`)
    console.log(`[fiscal 2024] el pasado cambió en:   $${(b - a).toFixed(2)}`)

    expect(a).toBeCloseTo(1216.67, 2) // 10,000 × 12% × 365/360
    // Un año fiscal cerrado no puede moverse por una operación posterior.
    expect(b).toBeCloseTo(a, 2)
  })

  it.fails('[PENDIENTE #5] vender en 2026 NO debería borrar el interés devengado de 2024', () => {
    const base = [
      op({ id: '1', activoId: 'rf1', tipo: 'compra', fecha: '2024-01-01', cantidad: 1, precioUnitario: 10000 }),
    ]
    const conVenta = [
      ...base,
      op({ id: '2', activoId: 'rf1', tipo: 'venta', fecha: '2026-06-01', cantidad: 1, precioUnitario: 12000 }),
    ]

    const a = resumirEventos(eventosFiscales([rf], base, 2024, '2026-08-09')).interesesDevengadosRf
    const b = resumirEventos(eventosFiscales([rf], conVenta, 2024, '2026-08-09')).interesesDevengadosRf

    console.log(`[fiscal 2024] con la posición abierta: $${a.toFixed(2)}`)
    console.log(`[fiscal 2024] tras vender en 2026:     $${b.toFixed(2)}`)

    expect(a).toBeGreaterThan(1000)
    // El interés que SÍ se devengó en 2024 debe seguir declarándose.
    expect(b).toBeCloseTo(a, 2)
  })
})

// ============================================== B9 · CUADRE ENTRE SUPERFICIES

describe('B9 · cuadre entre superficies', () => {
  const activos: Activo[] = [
    { id: 'a1', simbolo: 'AAA', nombre: 'A', clase: 'accion', moneda: 'MXN' },
    { id: 'a2', simbolo: 'BBB', nombre: 'B', clase: 'cripto', moneda: 'USD' },
  ]
  const ops: Operacion[] = [
    op({ id: '1', activoId: 'a1', tipo: 'compra', fecha: '2026-01-10', cantidad: 100, precioUnitario: 50 }),
    op({ id: '2', activoId: 'a1', tipo: 'venta', fecha: '2026-03-10', cantidad: 40, precioUnitario: 80, comision: 15 }),
    op({ id: '3', activoId: 'a1', tipo: 'dividendo', fecha: '2026-04-10', importeEfectivo: 250, comision: 10 }),
    op({ id: '4', activoId: 'a2', tipo: 'compra', fecha: '2026-02-01', cantidad: 2, precioUnitario: 1000, moneda: 'USD', tipoCambio: 18 }),
    op({ id: '5', activoId: 'a2', tipo: 'staking', fecha: '2026-05-01', cantidad: 0.1, precioUnitario: 1100, moneda: 'USD', tipoCambio: 17.5 }),
  ]

  it('[INVARIANTE] P&L realizado: Posiciones y Fiscal dan el MISMO número', () => {
    const port = calcularPortafolio(activos, ops, ctx({ precios: { a1: { precio: 90, moneda: 'MXN' } }, tiposCambio: { USD: 18 } }))
    const resumen = resumirEventos(eventosFiscales(activos, ops, 2026, '2026-08-09'))
    const fiscalRealizado = resumen.gananciasVentas + resumen.perdidasVentas
    expect(redondear(fiscalRealizado, 2)).toBeCloseTo(port.totales.pnlRealizado, 2)
  })

  it('[INVARIANTE] ingresos: Resumen y Fiscal dan el MISMO número', () => {
    const port = calcularPortafolio(activos, ops, ctx({ precios: { a1: { precio: 90, moneda: 'MXN' } }, tiposCambio: { USD: 18 } }))
    const resumen = resumirEventos(eventosFiscales(activos, ops, 2026, '2026-08-09'))
    const fiscalIngresos = resumen.dividendos + resumen.interesesCobrados + resumen.ingresosEspecie
    expect(redondear(fiscalIngresos, 2)).toBeCloseTo(port.totales.ingresos, 2)
  })

  it('[MEDICIÓN #14] Posiciones acumula y Fiscal filtra por año: bases distintas', () => {
    // No es un error de cálculo: son dos preguntas distintas. Lo que falta es
    // que la UI lo DIGA (hallazgo #14, arreglo propuesto: etiquetar la base).
    const conHistoria = [
      op({ id: '0', activoId: 'a1', tipo: 'compra', fecha: '2023-01-10', cantidad: 100, precioUnitario: 10 }),
      op({ id: '0b', activoId: 'a1', tipo: 'venta', fecha: '2023-06-10', cantidad: 100, precioUnitario: 40 }),
      ...ops,
    ]
    const port = calcularPortafolio(activos, conHistoria, ctx({ precios: { a1: { precio: 90, moneda: 'MXN' } }, tiposCambio: { USD: 18 } }))
    const resumen = resumirEventos(eventosFiscales(activos, conHistoria, 2026, '2026-08-09'))
    const fiscalRealizado = resumen.gananciasVentas + resumen.perdidasVentas
    console.log(`[cuadre] Posiciones (acumulado): ${port.totales.pnlRealizado} · Fiscal 2026: ${fiscalRealizado}`)
    expect(fiscalRealizado).not.toBeCloseTo(port.totales.pnlRealizado, 2)
  })
})
