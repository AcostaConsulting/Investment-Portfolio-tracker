/**
 * Edición de activos y operaciones como transformaciones puras del documento:
 * cada función recibe el documento y devuelve uno NUEVO, sin mutar el original.
 *
 * Integridad: `id`, `simbolo` y `clase` de un activo son estructurales (claves y
 * ruta de valuación) y nunca se editan aquí. El recálculo de posiciones, costo
 * promedio y KPIs no vive en este módulo: se deriva en `calcularPortafolio` a
 * partir de las operaciones, así que editar/eliminar una operación basta para
 * que todo se recalcule de forma determinista en el siguiente render.
 */

import type { Activo, Operacion } from './tipos'
import type { DocumentoStore } from '../state/documento'

/**
 * Metadatos de un activo que se pueden editar libremente. Excluye por diseño
 * `id`, `simbolo` y `clase`. Un valor `undefined` presente limpia el campo
 * opcional (ej. quitar el sector).
 */
export type MetadatosEditables = Partial<
  Pick<Activo, 'nombre' | 'moneda' | 'sector' | 'geografia' | 'etiquetaIds' | 'liquido' | 'rentaFija'>
>

const CLAVES_EDITABLES = [
  'nombre',
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
    // Forzados al final: jamás cambian aunque el parche intente sobrescribirlos.
    id: activo.id,
    simbolo: activo.simbolo,
    clase: activo.clase,
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
