/** Estado de UI efímero (no se persiste): modales globales. */

import { create } from 'zustand'

interface EstadoUi {
  modalPlanesAbierto: boolean
  abrirModalPlanes(): void
  cerrarModalPlanes(): void
}

export const useUi = create<EstadoUi>((set) => ({
  modalPlanesAbierto: false,
  abrirModalPlanes: () => set({ modalPlanesAbierto: true }),
  cerrarModalPlanes: () => set({ modalPlanesAbierto: false }),
}))
