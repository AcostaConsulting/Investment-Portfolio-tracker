import { contextBridge } from 'electron'

// El puente crece conforme se agregan capacidades (storage, licencias, precios).
contextBridge.exposeInMainWorld('api', {
  version: process.versions.electron,
})
