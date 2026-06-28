/**
 * Edición de activos y operaciones como transformaciones puras del documento:
 * cada función recibe el documento y devuelve uno NUEVO, sin mutar el original.
 *
 * Integridad: `id` y `simbolo` de un activo son su identidad (claves) y nunca se
 * editan aquí. La `clase` SÍ es editable (para corregir una mala clasificación);
 * cambiarla solo re-agrupa y re-valúa en el siguiente render, no corrompe datos
 * (las operaciones son agnósticas a la clase y el histórico no guarda la clase).
 * Quien cambie la clase debe enviar también un `sector`/`rentaFija` coherentes.
 * El recálculo de posiciones, costo promedio y KPIs no vive en este módulo: se
 * deriva en `calcularPortafolio` a partir de las operaciones, así que editar/
 * eliminar una operación basta para que todo se recalcule de forma determinista.
 */

import type { Activo, Operacion } from './tipos'
import type { DocumentoStore } from '../state/documento'

/**
 * Metadatos de un activo que se pueden editar libremente. Excluye por diseño
 * `id` y `simbolo` (la identidad del activo). Un valor `undefined` presente
 * limpia el campo opcional (ej. quitar el sector). `clase` es editable: al
 * cambiarla conviene mandar también `sector`/`rentaFija` coherentes.
 */
export type MetadatosEditables = Partial<
  Pick<Activo, 'nombre' | 'clase' | 'moneda' | 'sector' | 'geografia' | 'etiquetaIds' | 'liquido' | 'rentaFija'>
>

const CLAVES_EDITABLES = [
  'nombre',
  'clase',
  'moneda',
  'sector',
  'geografia',
  'etiquetaIds',
  'liquido',
  'rentaFija',
] as const satisfies readonly (keyof MetadatosEditables)[]

/** Toma solo las claves editables presentes (defensa ante parches casteados). */
function soloEditables(parche: MetadatosEditables): MetadatosEditables {
  const salida: MetadatosEditables = {}
  for (const clave of CLAVES_EDITABLES) {
    if (clave in parche) Object.assign(salida, { [clave]: parche[clave] })
  }
  return salida
}

function conMetadatos(activo: Activo, parche: MetadatosEditables): Activo {
  return {
    ...activo,
    ...soloEditables(parche),
    // Forzados al final: la identidad jamás cambia aunque el parche la traiga.
    id: activo.id,
    simbolo: activo.simbolo,
  }
}

/** Aplica metadatos editables al activo indicado, preservando su identidad. */
export function editarMetadatosActivo(
  doc: DocumentoStore,
  activoId: string,
  parche: MetadatosEditables,
): DocumentoStore {
  return {
    ...doc,
    activos: doc.activos.map((a) => (a.id === activoId ? conMetadatos(a, parche) : a)),
  }
}

/** Inserta o reemplaza una operación por `id` (upsert). */
export function editarOperacion(doc: DocumentoStore, operacion: Operacion): DocumentoStore {
  const existe = doc.operaciones.some((o) => o.id === operacion.id)
  return {
    ...doc,
    operaciones: existe
      ? doc.operaciones.map((o) => (o.id === operacion.id ? operacion : o))
      : [...doc.operaciones, operacion],
  }
}

/** Elimina la operación con el `id` dado. */
export function eliminarOperacion(doc: DocumentoStore, operacionId: string): DocumentoStore {
  return { ...doc, operaciones: doc.operaciones.filter((o) => o.id !== operacionId) }
}

/** Elimina en una sola pasada todas las operaciones cuyos ids estén en `operacionIds`. */
export function eliminarOperaciones(doc: DocumentoStore, operacionIds: string[]): DocumentoStore {
  if (operacionIds.length === 0) return doc
  const aBorrar = new Set(operacionIds)
  return { ...doc, operaciones: doc.operaciones.filter((o) => !aBorrar.has(o.id)) }
}
