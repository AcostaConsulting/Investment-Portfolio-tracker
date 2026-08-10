/**
 * Motor de renta fija mexicana.
 *
 * Convenciones de mercado implementadas:
 * - CETES: bonos cupón cero a descuento, año comercial de 360 días. La tasa
 *   capturada es la tasa de rendimiento; el interés total al vencimiento es
 *   monto * tasa * plazo/360 y se devenga linealmente.
 * - Bonos M: cupón fijo semestral (182 días), base 360. El devengado entre
 *   cupones es VN * tasa * días/360 por título.
 * - UDIBONOS: igual que Bono M pero denominado en UDIs; el valor en pesos
 *   se ajusta por el valor vigente de la UDI.
 * - Pagarés / SoFIPOs: tasa simple base 360 (convención bancaria).
 * - Ahorro (Nu y similares): tasa variable con capitalización diaria, base 365.
 *
 * ISR: la retención es un porcentaje ANUAL sobre el CAPITAL invertido
 * (no sobre el interés), prorrateado por días con base 365. La tasa la fija
 * Hacienda cada año; por eso es configurable (default 1.9%).
 */

import type { Activo, DetalleRentaFija } from './tipos'
import type { TramoPosicion } from './costeo'
import { diasEntre, sumarDias } from './fechas'
import { redondear } from './dinero'

export const TASA_ISR_DEFAULT = 1.9

export interface PosicionRentaFija {
  /** Títulos (bonos) o 1 para inversiones por monto. */
  cantidad: number
  /** Monto invertido en la moneda del instrumento. */
  costoNativo: number
  /**
   * Historia de la posición, en orden cronológico (la produce `recorrerCosteo`).
   *
   * Si viene, el devengo **integra la posición realmente sostenida en cada
   * tramo** en vez de aplicar el saldo de hoy a todo el plazo. Sin ella se
   * conserva el comportamiento viejo, que es lo que usan las pruebas del motor
   * y cualquier llamador que solo tenga un escalar.
   *
   * Por qué importa: con el escalar, una compra de 2026 reescribía el interés
   * declarado de 2024 (AUDITORIA-ROBUSTEZ.md #5) y una segunda compra devengaba
   * como si hubiera empezado con la primera (#10). Las dos cosas son la misma:
   * el devengo es una integral en el tiempo, no un producto.
   */
  tramos?: readonly TramoPosicion[]
}

export interface OpcionesValuacionRF {
  /** Tasa anual de retención ISR en % sobre capital. */
  tasaIsrAnual?: number
  /** Valor vigente de la UDI en MXN (UDIBONOS). */
  udiActual?: number
}

export interface ValuacionRentaFija {
  diasPlazo?: number
  diasTranscurridos: number
  /** Días para el vencimiento desde hoy; negativo si ya venció. */
  diasRestantes?: number
  vencido: boolean
  interesBrutoDevengado: number
  isrEstimadoDevengado: number
  /** Invertido + interés bruto devengado (y ajuste UDI si aplica). */
  valorBruto: number
  /** valorBruto − ISR estimado devengado. */
  valorNeto: number
  interesBrutoAlVencimiento?: number
  isrEstimadoAlVencimiento?: number
  netoAlVencimiento?: number
}

function tasaIsr(detalle: DetalleRentaFija, opciones: OpcionesValuacionRF): number {
  return detalle.tasaIsr ?? opciones.tasaIsrAnual ?? TASA_ISR_DEFAULT
}

/** ISR retenido estimado: % anual sobre capital, prorrateado por días (base 365). */
export function isrEstimado(capital: number, tasaIsrAnual: number, dias: number): number {
  if (dias <= 0 || capital <= 0) return 0
  return capital * (tasaIsrAnual / 100) * (dias / 365)
}

/**
 * Un tramo recortado a la ventana de devengo: cuánto capital hubo y por
 * cuántos días, dentro de `[inicio, fin]`.
 */
interface TramoEnVentana {
  costoNativo: number
  cantidad: number
  dias: number
}

/**
 * Recorta la historia de la posición a la ventana de devengo del instrumento.
 *
 * Cada tramo rige desde su fecha hasta la del siguiente; el último se extiende
 * hasta el final de la ventana. Lo que quede fuera —compras posteriores al
 * vencimiento, por ejemplo— aporta cero, que es justo lo que antes inflaba el
 * devengo de un plazo ya cerrado.
 */
function tramosEnVentana(
  tramos: readonly TramoPosicion[],
  inicio: string,
  fin: string,
): TramoEnVentana[] {
  const dentro: TramoEnVentana[] = []
  for (let i = 0; i < tramos.length; i++) {
    const tramo = tramos[i]!
    const siguiente = tramos[i + 1]
    // El tramo rige en [desde, hasta); se recorta contra [inicio, fin).
    const desde = tramo.desde > inicio ? tramo.desde : inicio
    const hastaTramo = siguiente ? siguiente.desde : fin
    const hasta = hastaTramo < fin ? hastaTramo : fin
    const dias = diasEntre(desde, hasta)
    if (dias > 0) dentro.push({ costoNativo: tramo.costoNativo, cantidad: tramo.cantidad, dias })
  }
  return dentro
}

/** Suma ponderada capital × días, en unidades de "peso-día". */
function pesoDias(tramos: TramoEnVentana[]): number {
  return tramos.reduce((s, t) => s + t.costoNativo * t.dias, 0)
}

/**
 * Valúa una posición de renta fija al día `hoy`.
 * Todos los montos en la moneda del instrumento.
 */
export function valuarRentaFija(
  detalle: DetalleRentaFija,
  posicion: PosicionRentaFija,
  hoy: string,
  opciones: OpcionesValuacionRF = {},
): ValuacionRentaFija {
  const monto = posicion.costoNativo
  const tasa = detalle.tasaAnual / 100
  const isr = tasaIsr(detalle, opciones)

  const diasPlazo = detalle.fechaVencimiento
    ? diasEntre(detalle.fechaInicio, detalle.fechaVencimiento)
    : undefined
  const transcurridosBruto = Math.max(0, diasEntre(detalle.fechaInicio, hoy))
  // Después del vencimiento el instrumento deja de devengar.
  const diasTranscurridos =
    diasPlazo !== undefined ? Math.min(transcurridosBruto, diasPlazo) : transcurridosBruto
  const diasRestantes = detalle.fechaVencimiento ? diasEntre(hoy, detalle.fechaVencimiento) : undefined
  const vencido = diasRestantes !== undefined && diasRestantes <= 0

  let interesDevengado = 0
  let interesAlVencimiento: number | undefined
  let ajusteUdi = 0

  // Historia de la posición recortada al plazo: si viene, el devengo se integra
  // tramo por tramo en vez de aplicar el saldo de hoy a todo el período.
  const fechaCorte = sumarDias(detalle.fechaInicio, diasTranscurridos)
  const ventana = posicion.tramos ? tramosEnVentana(posicion.tramos, detalle.fechaInicio, fechaCorte) : undefined

  switch (detalle.instrumento) {
    case 'cetes':
    case 'pagare':
    case 'sofipo': {
      // Tasa simple, base 360, devengo lineal.
      interesDevengado = ventana ? (tasa * pesoDias(ventana)) / 360 : monto * tasa * (diasTranscurridos / 360)
      if (diasPlazo !== undefined) interesAlVencimiento = monto * tasa * (diasPlazo / 360)
      break
    }
    case 'ahorro': {
      // Capitalización diaria, base 365. Sin vencimiento.
      interesDevengado = ventana
        ? ventana.reduce((s, t) => s + t.costoNativo * ((1 + tasa / 365) ** t.dias - 1), 0)
        : monto * ((1 + tasa / 365) ** diasTranscurridos - 1)
      break
    }
    case 'bono_m':
    case 'udibono': {
      // Devengado por cupones semestrales de 182 días sobre valor nominal.
      // Para bono_m el nominal está en pesos; para udibono está en UDIs.
      const valorNominal = detalle.valorNominal ?? 100
      const nominalTotal = posicion.cantidad * valorNominal
      const cuponesCompletos = Math.floor(diasTranscurridos / 182)
      const diasCuponActual = diasTranscurridos % 182
      // Los cupones completos ya se pagaron en efectivo (el usuario los captura
      // como operaciones de interés); aquí solo va el devengado del cupón en curso.
      if (posicion.tramos) {
        // El cupón en curso corre desde el último corte semestral: se integra la
        // TENENCIA (títulos) sobre ese tramo, no la de hoy sobre todo el cupón.
        const inicioCupon = sumarDias(detalle.fechaInicio, cuponesCompletos * 182)
        const enCupon = tramosEnVentana(posicion.tramos, inicioCupon, fechaCorte)
        const titulosDias = enCupon.reduce((s, t) => s + t.cantidad * valorNominal * t.dias, 0)
        interesDevengado = (tasa * titulosDias) / 360
      } else {
        interesDevengado = nominalTotal * tasa * (diasCuponActual / 360)
      }
      if (diasPlazo !== undefined) {
        // Proyección de cupones restantes hasta el vencimiento.
        const cuponesTotales = Math.ceil(diasPlazo / 182)
        const cuponesRestantes = cuponesTotales - cuponesCompletos
        interesAlVencimiento = nominalTotal * tasa * (182 / 360) * Math.max(0, cuponesRestantes)
      }
      if (detalle.instrumento === 'udibono') {
        // El interés se calculó en UDIs: se convierte a pesos con la UDI vigente
        // (o la de compra si no hay dato). El principal, pagado en pesos,
        // se revalúa con el movimiento de la UDI desde la compra.
        const udiCompra = detalle.udiInicial
        const udiHoy = opciones.udiActual ?? udiCompra
        if (udiHoy !== undefined) {
          interesDevengado *= udiHoy
          if (interesAlVencimiento !== undefined) interesAlVencimiento *= udiHoy
        }
        if (udiCompra && udiHoy && monto > 0) {
          const udisPrincipal = monto / udiCompra
          ajusteUdi = udisPrincipal * udiHoy - monto
        }
      }
      break
    }
  }

  // El ISR es un % anual sobre el CAPITAL, así que también depende de cuánto
  // capital hubo y por cuánto tiempo, no del saldo de hoy.
  const isrDevengado = ventana
    ? (isr / 100) * (ventana.reduce((s, t) => s + Math.max(0, t.costoNativo) * t.dias, 0) / 365)
    : isrEstimado(monto, isr, diasTranscurridos)
  const isrAlVencimiento = diasPlazo !== undefined ? isrEstimado(monto, isr, diasPlazo) : undefined

  const valorBruto = monto + interesDevengado + ajusteUdi
  const valorNeto = valorBruto - isrDevengado

  return {
    diasPlazo,
    diasTranscurridos,
    diasRestantes,
    vencido,
    interesBrutoDevengado: redondear(interesDevengado, 6),
    isrEstimadoDevengado: redondear(isrDevengado, 6),
    valorBruto: redondear(valorBruto, 6),
    valorNeto: redondear(valorNeto, 6),
    interesBrutoAlVencimiento:
      interesAlVencimiento !== undefined ? redondear(interesAlVencimiento, 6) : undefined,
    isrEstimadoAlVencimiento:
      isrAlVencimiento !== undefined ? redondear(isrAlVencimiento, 6) : undefined,
    netoAlVencimiento:
      interesAlVencimiento !== undefined && isrAlVencimiento !== undefined
        ? redondear(monto + interesAlVencimiento + ajusteUdi - isrAlVencimiento, 6)
        : undefined,
  }
}

/** Precio teórico de un CETE dado tasa de descuento y días al vencimiento. */
export function precioCete(tasaDescuentoPct: number, diasAlVencimiento: number, valorNominal = 10): number {
  return valorNominal * (1 - (tasaDescuentoPct / 100) * (diasAlVencimiento / 360))
}

/** Convierte tasa de descuento de CETES a tasa de rendimiento equivalente. */
export function tasaRendimientoCete(tasaDescuentoPct: number, diasAlVencimiento: number): number {
  const d = tasaDescuentoPct / 100
  const t = diasAlVencimiento / 360
  return (d / (1 - d * t)) * 100
}

export interface AlertaVencimiento {
  activoId: string
  simbolo: string
  nombre: string
  fechaVencimiento: string
  /** Negativo o cero si ya venció. */
  diasRestantes: number
  vencido: boolean
}

/**
 * Activos de renta fija que vencen dentro de `diasUmbral` días (o ya vencieron).
 * Ordenados del vencimiento más próximo al más lejano.
 */
export function alertasVencimiento(
  activos: Activo[],
  hoy: string,
  diasUmbral = 30,
): AlertaVencimiento[] {
  const alertas: AlertaVencimiento[] = []
  for (const activo of activos) {
    const detalle = activo.rentaFija
    if (!detalle?.fechaVencimiento) continue
    const diasRestantes = diasEntre(hoy, detalle.fechaVencimiento)
    if (diasRestantes <= diasUmbral) {
      alertas.push({
        activoId: activo.id,
        simbolo: activo.simbolo,
        nombre: activo.nombre,
        fechaVencimiento: detalle.fechaVencimiento,
        diasRestantes,
        vencido: diasRestantes <= 0,
      })
    }
  }
  return alertas.sort((a, b) => a.diasRestantes - b.diasRestantes)
}

/** Fechas teóricas de pago de cupón para bonos M / UDIBONOS (cada 182 días). */
export function fechasCupon(detalle: DetalleRentaFija): string[] {
  if (!detalle.fechaVencimiento) return []
  if (detalle.instrumento !== 'bono_m' && detalle.instrumento !== 'udibono') return []
  const fechas: string[] = []
  let fecha = detalle.fechaInicio
  for (;;) {
    fecha = sumarDias(fecha, 182)
    if (diasEntre(fecha, detalle.fechaVencimiento) < 0) break
    fechas.push(fecha)
  }
  if (fechas[fechas.length - 1] !== detalle.fechaVencimiento) fechas.push(detalle.fechaVencimiento)
  return fechas
}
