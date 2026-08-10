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
  revisarForma,
  type Ajustes,
  type AlertaPrecio,
  type BenchmarkManual,
  type DocumentoStore,
  type Etiqueta,
  type Meta,
  type ObjetivoRebalanceo,
} from './documento'
import {
  editarMetadatosActivo as editarMetadatosActivoDoc,
  editarOperacion as editarOperacionDoc,
  eliminarOperacion as eliminarOperacionDoc,
  eliminarOperaciones as eliminarOperacionesDoc,
  type MetadatosEditables,
} from '../engine/edicionActivo'
import { aplicarCorrecciones, type CorreccionTc } from '../engine/correccionTcDof'
import { planEfectivo, validarLicencia, type EstadoLicencia } from '../licencias/validar'
import { crearDatosEjemplo } from './ejemplo'
import type { Plan } from '../licencias/planes'
import type { ResumenRespaldo } from '../shared/api'
import { textoABase64 } from '../servicios/respaldo'
import { hoyIso } from '../engine/fechas'
import llavePublicaPem from '../licencias/llave-publica.pem?raw'

const RETRASO_GUARDADO_MS = 600

let temporizadorGuardado: ReturnType<typeof setTimeout> | undefined
let cargaEnCurso = false
let docPendiente: DocumentoStore | undefined
/**
 * Mientras la pantalla de recuperación no se resuelva no se escribe NADA a
 * disco. Es lo que impide que un clic cualquiera sobrescriba un documento que
 * no se pudo leer — el corazón del hallazgo #3.
 */
let guardadoBloqueado = false

async function escribirAhora(doc: DocumentoStore): Promise<void> {
  const r = await window.api?.almacen.guardar(doc)
  // Antes esto era `void ...guardar(doc)`: el rechazo se descartaba y guardar
  // contra un archivo bloqueado o de solo lectura fallaba en absoluto silencio
  // (AUDITORIA-ROBUSTEZ.md §1.2). Ahora el fallo llega al estado y a la UI.
  if (r && r.ok === false) {
    useApp.setState({ errorGuardado: { codigo: r.codigo, error: r.error, ruta: r.ruta } })
  } else if (r && r.ok) {
    if (useApp.getState().errorGuardado) useApp.setState({ errorGuardado: undefined })
  }
}

/** Vacía el guardado pendiente sin esperar al debounce. */
async function vaciarPendiente(): Promise<void> {
  clearTimeout(temporizadorGuardado)
  temporizadorGuardado = undefined
  const doc = docPendiente
  docPendiente = undefined
  if (doc) await escribirAhora(doc)
}

function persistir(doc: DocumentoStore) {
  if (guardadoBloqueado) return
  docPendiente = doc
  clearTimeout(temporizadorGuardado)
  temporizadorGuardado = setTimeout(() => {
    void vaciarPendiente()
  }, RETRASO_GUARDADO_MS)
}

/**
 * Main retiene el cierre de la ventana y pide esto; al contestar, se cierra.
 * Sin ello se perdía lo capturado en los últimos 600 ms (hallazgo #8).
 */
function atenderFlushAlCerrar(): void {
  window.api?.almacen.alPedirFlush(() => {
    void vaciarPendiente().finally(() => window.api?.almacen.flushListo())
  })
}

/**
 * El documento de disco no se pudo usar. La app NO arranca como primer uso ni
 * escribe nada: enseña la pantalla de recuperación y espera al usuario.
 */
export interface EstadoRecuperacion {
  /** `ilegible`: no parsea. `forma`: parsea pero tiene campos con forma inválida. */
  motivo: 'ilegible' | 'forma'
  detalle: string
  bytes: number
  /** Dónde quedó la copia del archivo original. Se hace ANTES de mostrar nada. */
  copia: string | null
  respaldos: ResumenRespaldo[]
}

export interface ErrorGuardado {
  codigo: string
  error: string
  ruta: string
}

export interface EstadoApp {
  cargado: boolean
  doc: DocumentoStore
  licenciaEstado?: EstadoLicencia
  plan: Plan
  /** Presente = la app está en modo recuperación y no escribe a disco. */
  recuperacion?: EstadoRecuperacion
  /** Presente = el último guardado falló y el usuario tiene que enterarse. */
  errorGuardado?: ErrorGuardado

  inicializar(): Promise<void>
  mutarDoc(cambia: (doc: DocumentoStore) => DocumentoStore): void

  /** Recuperación: carga el respaldo que el usuario eligió y reanuda el guardado. */
  restaurarRespaldo(nombre: string): Promise<{ ok: boolean; error?: string }>
  /** Recuperación: empezar con un portafolio vacío, conservando la copia del original. */
  empezarDeCero(): void
  /** Guarda una copia del documento en la carpeta que elija el usuario (salida de emergencia). */
  guardarCopiaDeEmergencia(): Promise<{ ok: boolean; ruta?: string }>

  guardarActivo(activo: Activo): void
  eliminarActivo(id: string): void
  /** Edita metadatos de un activo (nunca su id/símbolo/clase) vía engine. */
  editarMetadatosActivo(activoId: string, parche: MetadatosEditables): void
  guardarOperacion(operacion: Operacion): void
  eliminarOperacion(id: string): void
  /** Borrado masivo: elimina varias operaciones en una sola mutación (un solo guardado). */
  eliminarOperaciones(ids: string[]): void
  /** Reescribe el `tipoCambio` de las operaciones indicadas (corrección al TC del DOF). */
  corregirTiposCambio(correcciones: CorreccionTc[]): void
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
  guardarBenchmark(benchmark: BenchmarkManual): void
  eliminarBenchmark(id: string): void
  fijarRebalanceo(objetivo: ObjetivoRebalanceo | undefined): void
  completarOnboarding(): void
  completarTour(): void
  /** Carga el portafolio ficticio del onboarding. */
  cargarDatosEjemplo(): void
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
    atenderFlushAlCerrar()

    const resultado = await window.api?.almacen.cargar()

    // Sin preload (vite dev en navegador) se arranca vacío, como siempre.
    if (!resultado || resultado.estado === 'vacio') {
      set({ doc: documentoInicial(), cargado: true, plan: 'free' })
      return
    }

    if (resultado.estado === 'ilegible') {
      // Hay un archivo y no se pudo leer. **No** es primer uso.
      guardadoBloqueado = true
      set({
        doc: documentoInicial(),
        cargado: true,
        plan: 'free',
        recuperacion: {
          motivo: 'ilegible',
          detalle: resultado.error,
          bytes: resultado.bytes,
          copia: resultado.copia,
          respaldos: resultado.respaldos,
        },
      })
      return
    }

    // Parsea, pero puede tener campos con forma inválida (hallazgo #7: eso
    // dejaba la ventana en blanco sin un solo mensaje).
    const problemas = revisarForma(resultado.documento)
    if (problemas.length > 0) {
      guardadoBloqueado = true
      const extra = await window.api?.almacen.prepararRecuperacion()
      set({
        doc: documentoInicial(),
        cargado: true,
        plan: 'free',
        recuperacion: {
          motivo: 'forma',
          detalle: problemas.join(', '),
          bytes: extra?.bytes ?? 0,
          copia: extra?.copia ?? null,
          respaldos: extra?.respaldos ?? [],
        },
      })
      return
    }

    const doc = migrarDocumento(resultado.documento)
    let licenciaEstado: EstadoLicencia | undefined
    if (doc.licencia) {
      licenciaEstado = await validarLicencia(doc.licencia, llavePublicaPem, hoyIso())
    }
    set({ doc, cargado: true, licenciaEstado, plan: planEfectivo(licenciaEstado) })
  },

  async restaurarRespaldo(nombre) {
    const r = await window.api?.almacen.leerRespaldo(nombre)
    if (!r || !r.ok) return { ok: false, error: r?.error ?? 'No se pudo leer el respaldo' }
    if (revisarForma(r.documento).length > 0) return { ok: false, error: 'forma' }
    const doc = migrarDocumento(r.documento)
    guardadoBloqueado = false
    set({ doc, recuperacion: undefined })
    persistir(doc)
    if (doc.licencia) {
      const estado = await validarLicencia(doc.licencia, llavePublicaPem, hoyIso())
      set({ licenciaEstado: estado, plan: planEfectivo(estado) })
    }
    return { ok: true }
  },

  empezarDeCero() {
    const doc = documentoInicial()
    guardadoBloqueado = false
    set({ doc, recuperacion: undefined, licenciaEstado: undefined, plan: 'free' })
    persistir(doc)
  },

  async guardarCopiaDeEmergencia() {
    const doc = get().doc
    const r = await window.api?.dialogo.guardar({
      sugerido: `patrimo-copia-${hoyIso()}.json`,
      filtros: [{ nombre: 'JSON', extensiones: ['json'] }],
      contenidoBase64: textoABase64(JSON.stringify(doc, null, 2)),
    })
    return { ok: r?.guardado ?? false, ruta: r?.ruta }
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

  editarMetadatosActivo(activoId, parche) {
    get().mutarDoc((doc) => editarMetadatosActivoDoc(doc, activoId, parche))
  },

  guardarOperacion(operacion) {
    get().mutarDoc((doc) => editarOperacionDoc(doc, operacion))
  },

  eliminarOperacion(id) {
    get().mutarDoc((doc) => eliminarOperacionDoc(doc, id))
  },

  eliminarOperaciones(ids) {
    get().mutarDoc((doc) => eliminarOperacionesDoc(doc, ids))
  },
  corregirTiposCambio(correcciones) {
    if (correcciones.length === 0) return
    get().mutarDoc((doc) => ({ ...doc, operaciones: aplicarCorrecciones(doc.operaciones, correcciones) }))
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

  guardarBenchmark(benchmark) {
    get().mutarDoc((doc) => ({
      ...doc,
      benchmarks: doc.benchmarks.some((b) => b.id === benchmark.id)
        ? doc.benchmarks.map((b) => (b.id === benchmark.id ? benchmark : b))
        : [...doc.benchmarks, benchmark],
    }))
  },

  eliminarBenchmark(id) {
    get().mutarDoc((doc) => ({ ...doc, benchmarks: doc.benchmarks.filter((b) => b.id !== id) }))
  },

  fijarRebalanceo(objetivo) {
    get().mutarDoc((doc) => ({ ...doc, rebalanceo: objetivo }))
  },

  completarOnboarding() {
    get().mutarDoc((doc) => ({ ...doc, onboardingCompletado: true }))
  },

  cargarDatosEjemplo() {
    const ejemplo = crearDatosEjemplo()
    get().mutarDoc((doc) => ({
      ...doc,
      activos: [...doc.activos, ...ejemplo.activos],
      operaciones: [...doc.operaciones, ...ejemplo.operaciones],
      precios: { ...doc.precios, ...ejemplo.precios },
      tiposCambio: { ...ejemplo.tiposCambio, ...doc.tiposCambio },
    }))
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
