/** Estado de UI efímero (no se persiste): modales globales. */

import { create } from 'zustand'

interface EstadoUi {
  modalPlanesAbierto: boolean
  abrirModalPlanes(): void
  cerrarModalPlanes(): void
  /** Id del activo cuyo detalle se está viendo; undefined = ninguno. */
  activoDetalle?: string
  abrirDetalle(activoId: string): void
  cerrarDetalle(): void
}

export const useUi = create<EstadoUi>((set) => ({
  modalPlanesAbierto: false,
  abrirModalPlanes: () => set({ modalPlanesAbierto: true }),
  cerrarModalPlanes: () => set({ modalPlanesAbierto: false }),
  activoDetalle: undefined,
  abrirDetalle: (activoId) => set({ activoDetalle: activoId }),
  cerrarDetalle: () => set({ activoDetalle: undefined }),
}))
