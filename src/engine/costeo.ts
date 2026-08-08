/**
 * Costeo de una posición: la fórmula del costo promedio ponderado, escrita
 * UNA sola vez.
 *
 * Existe por la misma razón que `asignacion.ts` (§13.3): esta cuenta estaba
 * escrita dos veces —dentro de `acumularOperaciones` en `portafolio.ts` y
 * dentro de `eventosFiscales` en `fiscal.ts`— y las dos copias ya habían
 * divergido de verdad, no en teoría (§16). Cualquier consumidor nuevo que
 * necesite costo, costo promedio o ganancia realizada entra por aquí.
 *
 * Las reglas del costeo, en un solo sitio:
 * 1. Las operaciones se recorren en orden cronológico.
 * 2. Una compra suma cantidad y suma costo (importe + comisión).
 * 3. Una venta consume al costo promedio vigente: el costo baja en proporción
 *    a lo vendido y la diferencia contra el precio de venta es el realizado.
 * 4. Una venta que excede la tenencia se acota a la tenencia y avisa.
 * 5. Un ajuste negativo retira cantidad y costo en proporción, sin realizar P&L.
 * 6. Dividendo/interés no tocan la cantidad: son ingreso.
 * 7. Staking/airdrop/recompensa entran a valor de captura: ese valor es a la
 *    vez ingreso y costo (base gravable y de P&L futura).
 * 8. Al cerrar la posición se limpian los residuos de punto flotante.
 *
 * Todo el dinero se lleva en DOS pistas: `base` (moneda base del usuario, con
 * el tipo de cambio capturado en cada operación) y `nativo` (moneda del
 * activo, válido solo si todas las operaciones se capturaron en ella).
 *
 * Módulo hoja: solo importa tipos y helpers, nunca a sus consumidores.
 */

import type { Activo, Advertencia, Operacion } from './tipos'
import { OPERACIONES_EFECTIVO, OPERACIONES_EN_ESPECIE } from './tipos'
import { compararPorFecha } from './fechas'

/** Estado acumulado de la posición tras recorrer todas sus operaciones. */
export interface EstadoCosteo {
  cantidad: number
  /** Costo del holding vigente en moneda base (histórico). */
  costoBase: number
  /** Costo en la moneda del activo; solo válido si `monedaMixta` es false. */
  costoNativo: number
  monedaMixta: boolean
  /** P&L realizado acumulado (ventas) en base. */
  realizadoBase: number
  /** Dividendos, intereses y recompensas en especie valuadas, en base. */
  ingresosBase: number
  comisionesBase: number
}

/**
 * Lo que ocurrió en cada operación con efecto económico, en el orden en que
 * se procesó. Lo consume el reporte fiscal, que necesita el detalle por
 * operación y no solo el acumulado.
 */
export type EventoCosteo =
  | {
      tipo: 'venta'
      operacion: Operacion
      /** Cantidad efectivamente vendida (ya acotada a la tenencia). */
      vendida: number
      /** Ingreso bruto de la venta en base, sin restar comisión ni costo. */
      brutoBase: number
      /** Ganancia(+)/pérdida(−) contra el costo promedio, neta de comisión. */
      resultadoBase: number
    }
  | {
      tipo: 'especie'
      operacion: Operacion
      /** Valor de captura en base, antes de comisión. */
      brutoBase: number
      /** Ingreso neto de comisión, en base. */
      montoBase: number
    }
  | {
      tipo: 'efectivo'
      operacion: Operacion
      /** Ingreso neto de comisión, en base. */
      montoBase: number
    }

export interface ResultadoCosteo {
  estado: EstadoCosteo
  eventos: EventoCosteo[]
}

/**
 * Importe bruto de una operación en moneda base, para MOSTRAR (listas, Excel).
 *
 * Los eventos de flujo de efectivo —dividendo, interés— se capturan con
 * `cantidad` y `precioUnitario` en 0 y el monto en `importeEfectivo`, así que
 * `cantidad × precio` da cero para ellos. Esa cuenta estaba escrita a mano en
 * tres vistas y solo una la hacía bien: Movimientos mostraba el dividendo y
 * el Detalle y el Excel lo mostraban en $0.00 (§16.7).
 *
 * Es el importe BRUTO, sin restar comisión: es lo que mueve la operación, no
 * el ingreso neto. El ingreso neto lo lleva `recorrerCosteo`.
 */
export function importeBaseOperacion(op: Operacion): number {
  return op.importeEfectivo !== undefined
    ? op.importeEfectivo * op.tipoCambio
    : op.cantidad * op.precioUnitario * op.tipoCambio
}

function estadoVacio(): EstadoCosteo {
  return {
    cantidad: 0,
    costoBase: 0,
    costoNativo: 0,
    monedaMixta: false,
    realizadoBase: 0,
    ingresosBase: 0,
    comisionesBase: 0,
  }
}

/**
 * Recorre las operaciones de un activo en orden cronológico aplicando costo
 * promedio ponderado. Devuelve el estado final y el detalle por operación.
 *
 * `advertencias` se llena por efecto lateral (mismo contrato que tenía
 * `acumularOperaciones`): quien no las necesite puede pasar un arreglo suelto.
 */
export function recorrerCosteo(
  activo: Activo,
  operaciones: Operacion[],
  advertencias: Advertencia[],
): ResultadoCosteo {
  const estado = estadoVacio()
  const eventos: EventoCosteo[] = []
  const ordenadas = [...operaciones].sort(compararPorFecha)

  for (const op of ordenadas) {
    let tc = op.tipoCambio
    if (!(tc > 0)) {
      advertencias.push({ codigo: 'sin_tipo_cambio', activoId: activo.id, operacionId: op.id })
      tc = 1
    }
    const esMonedaNativa = op.moneda === activo.moneda
    if (!esMonedaNativa) estado.monedaMixta = true

    const comision = op.comision ?? 0
    const comisionBase = comision * tc
    estado.comisionesBase += comisionBase
    const importeBase = op.cantidad * op.precioUnitario * tc

    switch (op.tipo) {
      case 'compra': {
        estado.cantidad += op.cantidad
        estado.costoBase += importeBase + comisionBase
        if (esMonedaNativa) estado.costoNativo += op.cantidad * op.precioUnitario + comision
        break
      }
      case 'venta': {
        let vendida = op.cantidad
        if (vendida > estado.cantidad + 1e-12) {
          advertencias.push({
            codigo: 'venta_excede_tenencia',
            activoId: activo.id,
            operacionId: op.id,
            detalle: `venta de ${op.cantidad}, tenencia ${estado.cantidad}`,
          })
          vendida = estado.cantidad
        }
        if (vendida <= 0) break
        const ppBase = estado.costoBase / estado.cantidad
        const ppNativo = estado.costoNativo / estado.cantidad
        const brutoBase = vendida * op.precioUnitario * tc
        const resultadoBase = brutoBase - comisionBase - vendida * ppBase
        estado.realizadoBase += resultadoBase
        estado.costoBase -= vendida * ppBase
        estado.costoNativo -= vendida * ppNativo
        estado.cantidad -= vendida
        eventos.push({ tipo: 'venta', operacion: op, vendida, brutoBase, resultadoBase })
        break
      }
      case 'ajuste': {
        if (op.cantidad >= 0) {
          // Ej. split o corrección al alza: entra cantidad al costo capturado (usualmente 0).
          estado.cantidad += op.cantidad
          estado.costoBase += importeBase
          if (esMonedaNativa) estado.costoNativo += op.cantidad * op.precioUnitario
        } else {
          // Retiro sin P&L: reduce cantidad y costo proporcionalmente.
          let retiro = -op.cantidad
          if (retiro > estado.cantidad + 1e-12) {
            advertencias.push({
              codigo: 'ajuste_excede_tenencia',
              activoId: activo.id,
              operacionId: op.id,
            })
            retiro = estado.cantidad
          }
          if (estado.cantidad > 0) {
            const proporcion = retiro / estado.cantidad
            estado.costoBase -= estado.costoBase * proporcion
            estado.costoNativo -= estado.costoNativo * proporcion
            estado.cantidad -= retiro
          }
        }
        break
      }
      default: {
        if (OPERACIONES_EFECTIVO.has(op.tipo)) {
          // Dividendo/interés: efectivo, no toca la cantidad. El ingreso sale del
          // importe explícito si está, o se deriva de cantidad × precio (legacy).
          const ingresoBruto = op.importeEfectivo !== undefined ? op.importeEfectivo * tc : importeBase
          const montoBase = ingresoBruto - comisionBase
          estado.ingresosBase += montoBase
          eventos.push({ tipo: 'efectivo', operacion: op, montoBase })
        } else if (OPERACIONES_EN_ESPECIE.has(op.tipo)) {
          // Staking/airdrop/recompensa: entra cantidad a valor de mercado capturado;
          // ese valor es a la vez ingreso y costo (base gravable y de P&L futura).
          estado.cantidad += op.cantidad
          estado.costoBase += importeBase
          if (esMonedaNativa) estado.costoNativo += op.cantidad * op.precioUnitario
          const montoBase = importeBase - comisionBase
          estado.ingresosBase += montoBase
          eventos.push({ tipo: 'especie', operacion: op, brutoBase: importeBase, montoBase })
        }
        break
      }
    }
  }

  // Limpia residuos de punto flotante en posiciones cerradas.
  if (Math.abs(estado.cantidad) < 1e-9) {
    estado.cantidad = 0
    estado.costoBase = 0
    estado.costoNativo = 0
  }
  return { estado, eventos }
}
