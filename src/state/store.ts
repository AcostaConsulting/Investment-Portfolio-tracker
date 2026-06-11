/**
 * Estado global de la app. Una sola fuente de verdad: el DocumentoStore.
 * Cada mutación pasa por `mutarDoc`, que persiste con debounce — el usuario
 * nunca piensa en "guardar".
 */

import { create } from 'zustand'
import type { Activo, Operacion, PrecioActual } from '../engine/tipos'
import {
  documentoInicial,
  migrarDocumento,
  type Ajustes,
  type AlertaPrecio,
  type DocumentoStore,
  type Etiqueta,
  type Meta,
  type ObjetivoRebalanceo,
} from './documento'
import { planEfectivo, validarLicencia, type EstadoLicencia } from '../licencias/validar'
import type { Plan } from '../licencias/planes'
import { hoyIso } from '../engine/fechas'
import llavePublicaPem from '../licencias/llave-publica.pem?raw'

const RETRASO_GUARDADO_MS = 600

let temporizadorGuardado: ReturnType<typeof setTimeout> | undefined
let cargaEnCurso = false

function persistir(doc: DocumentoStore) {
  clearTimeout(temporizadorGuardado)
  temporizadorGuardado = setTimeout(() => {
    void window.api?.almacen.guardar(doc)
  }, RETRASO_GUARDADO_MS)
}

export interface EstadoApp {
  cargado: boolean
  doc: DocumentoStore
  licenciaEstado?: EstadoLicencia
  plan: Plan

  inicializar(): Promise<void>
  mutarDoc(cambia: (doc: DocumentoStore) => DocumentoStore): void

  guardarActivo(activo: Activo): void
  eliminarActivo(id: string): void
  guardarOperacion(operacion: Operacion): void
  eliminarOperacion(id: string): void
  fijarPrecio(activoId: string, precio: PrecioActual): void
  fijarTipoCambio(moneda: string, valor: number): void
  actualizarAjustes(parcial: Partial<Ajustes>): void
  guardarEtiqueta(etiqueta: Etiqueta): void
  /** Elimina la etiqueta y la desprende de todos los activos. */
  eliminarEtiqueta(id: string): void
  guardarMeta(meta: Meta): void
  eliminarMeta(id: string): void
  guardarAlertaPrecio(alerta: AlertaPrecio): void
  eliminarAlertaPrecio(id: string): void
  fijarRebalanceo(objetivo: ObjetivoRebalanceo | undefined): void
  completarOnboarding(): void
  completarTour(): void
  /** Guarda el valor del portafolio del día (un punto por fecha). */
  registrarSnapshot(valor: number): void

  /** Alta masiva (import de Excel): activos nuevos + operaciones en una sola mutación. */
  importarLote(activosNuevos: Activo[], operaciones: Operacion[]): void

  activarLicencia(cadena: string): Promise<EstadoLicencia>
  quitarLicencia(): void
  reemplazarDocumento(doc: DocumentoStore): void
}

export const useApp = create<EstadoApp>((set, get) => ({
  cargado: false,
  doc: documentoInicial(),
  licenciaEstado: undefined,
  plan: 'free',

  async inicializar() {
    // Idempotente: StrictMode monta los efectos dos veces en desarrollo.
    if (get().cargado || cargaEnCurso) return
    cargaEnCurso = true
    const crudo = await window.api?.almacen.cargar()
    const doc = migrarDocumento(crudo ?? null)
    let licenciaEstado: EstadoLicencia | undefined
    if (doc.licencia) {
      licenciaEstado = await validarLicencia(doc.licencia, llavePublicaPem, hoyIso())
    }
    set({ doc, cargado: true, licenciaEstado, plan: planEfectivo(licenciaEstado) })
  },

  mutarDoc(cambia) {
    const doc = cambia(get().doc)
    set({ doc })
    persistir(doc)
  },

  guardarActivo(activo) {
    get().mutarDoc((doc) => ({
      ...doc,
      activos: doc.activos.some((a) => a.id === activo.id)
        ? doc.activos.map((a) => (a.id === activo.id ? activo : a))
        : [...doc.activos, activo],
    }))
  },

  eliminarActivo(id) {
    get().mutarDoc((doc) => {
      const precios = { ...doc.precios }
      delete precios[id]
      return {
        ...doc,
        activos: doc.activos.filter((a) => a.id !== id),
        operaciones: doc.operaciones.filter((o) => o.activoId !== id),
        alertasPrecio: doc.alertasPrecio.filter((al) => al.activoId !== id),
        precios,
      }
    })
  },

  guardarOperacion(operacion) {
    get().mutarDoc((doc) => ({
      ...doc,
      operaciones: doc.operaciones.some((o) => o.id === operacion.id)
        ? doc.operaciones.map((o) => (o.id === operacion.id ? operacion : o))
        : [...doc.operaciones, operacion],
    }))
  },

  eliminarOperacion(id) {
    get().mutarDoc((doc) => ({ ...doc, operaciones: doc.operaciones.filter((o) => o.id !== id) }))
  },

  fijarPrecio(activoId, precio) {
    get().mutarDoc((doc) => ({ ...doc, precios: { ...doc.precios, [activoId]: precio } }))
  },

  fijarTipoCambio(moneda, valor) {
    get().mutarDoc((doc) => ({ ...doc, tiposCambio: { ...doc.tiposCambio, [moneda]: valor } }))
  },

  actualizarAjustes(parcial) {
    get().mutarDoc((doc) => ({ ...doc, ajustes: { ...doc.ajustes, ...parcial } }))
  },

  guardarEtiqueta(etiqueta) {
    get().mutarDoc((doc) => ({
      ...doc,
      etiquetas: doc.etiquetas.some((e) => e.id === etiqueta.id)
        ? doc.etiquetas.map((e) => (e.id === etiqueta.id ? etiqueta : e))
        : [...doc.etiquetas, etiqueta],
    }))
  },

  eliminarEtiqueta(id) {
    get().mutarDoc((doc) => ({
      ...doc,
      etiquetas: doc.etiquetas.filter((e) => e.id !== id),
      activos: doc.activos.map((a) =>
        a.etiquetaIds?.includes(id) ? { ...a, etiquetaIds: a.etiquetaIds.filter((x) => x !== id) } : a,
      ),
    }))
  },

  guardarMeta(meta) {
    get().mutarDoc((doc) => ({
      ...doc,
      metas: doc.metas.some((m) => m.id === meta.id)
        ? doc.metas.map((m) => (m.id === meta.id ? meta : m))
        : [...doc.metas, meta],
    }))
  },

  eliminarMeta(id) {
    get().mutarDoc((doc) => ({ ...doc, metas: doc.metas.filter((m) => m.id !== id) }))
  },

  guardarAlertaPrecio(alerta) {
    get().mutarDoc((doc) => ({
      ...doc,
      alertasPrecio: doc.alertasPrecio.some((a) => a.id === alerta.id)
        ? doc.alertasPrecio.map((a) => (a.id === alerta.id ? alerta : a))
        : [...doc.alertasPrecio, alerta],
    }))
  },

  eliminarAlertaPrecio(id) {
    get().mutarDoc((doc) => ({ ...doc, alertasPrecio: doc.alertasPrecio.filter((a) => a.id !== id) }))
  },

  fijarRebalanceo(objetivo) {
    get().mutarDoc((doc) => ({ ...doc, rebalanceo: objetivo }))
  },

  completarOnboarding() {
    get().mutarDoc((doc) => ({ ...doc, onboardingCompletado: true }))
  },

  completarTour() {
    get().mutarDoc((doc) => ({ ...doc, tourCompletado: true }))
  },

  registrarSnapshot(valor) {
    const hoy = hoyIso()
    const { historico } = get().doc
    const ultimo = historico[historico.length - 1]
    // Mismo día con mismo valor: nada que hacer (evita guardados en cascada).
    if (ultimo?.fecha === hoy && Math.abs(ultimo.valor - valor) < 0.005) return
    get().mutarDoc((doc) => {
      const puntos =
        ultimo?.fecha === hoy
          ? doc.historico.map((p) => (p.fecha === hoy ? { fecha: hoy, valor } : p))
          : [...doc.historico, { fecha: hoy, valor }]
      return { ...doc, historico: puntos.slice(-1100) }
    })
  },

  importarLote(activosNuevos, operaciones) {
    get().mutarDoc((doc) => ({
      ...doc,
      activos: [...doc.activos, ...activosNuevos],
      operaciones: [...doc.operaciones, ...operaciones],
    }))
  },

  async activarLicencia(cadena) {
    const estado = await validarLicencia(cadena, llavePublicaPem, hoyIso())
    if (estado.estado !== 'invalida') {
      get().mutarDoc((doc) => ({ ...doc, licencia: cadena.replace(/\s+/g, '') }))
    }
    set({ licenciaEstado: estado, plan: planEfectivo(estado) })
    return estado
  },

  quitarLicencia() {
    get().mutarDoc((doc) => ({ ...doc, licencia: undefined }))
    set({ licenciaEstado: undefined, plan: 'free' })
  },

  reemplazarDocumento(doc) {
    set({ doc })
    persistir(doc)
    // La licencia del documento restaurado se revalida.
    if (doc.licencia) {
      void validarLicencia(doc.licencia, llavePublicaPem, hoyIso()).then((estado) =>
        set({ licenciaEstado: estado, plan: planEfectivo(estado) }),
      )
    } else {
      set({ licenciaEstado: undefined, plan: 'free' })
    }
  },
}))
