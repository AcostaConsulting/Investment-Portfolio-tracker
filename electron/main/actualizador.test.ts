/**
 * La guarda del canal de Microsoft Store.
 *
 * §26.5 midió que `process.windowsStore` no aparecía en el repo y que la única
 * guarda de arranque era `!app.isPackaged` — pero un MSIX **sí** está
 * empaquetado, así que `electron-updater` se habría inicializado dentro del
 * paquete de Store. Un MSIX vive en `WindowsApps`, de sólo lectura y firmado:
 * el updater no puede parchearlo, instalaría el NSIS **al lado** y dejaría dos
 * Patrimos conviviendo (§27.2).
 *
 * Lo que estas pruebas fijan es lo que NO se puede probar en esta máquina en
 * vivo (hace falta el entorno de escritorio interactivo de §27.7): que con la
 * señal de Store puesta, **`electron-updater` no se toca ni una vez**.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const autoUpdater = {
  logger: undefined as unknown,
  autoDownload: true,
  autoInstallOnAppQuit: true,
  checkForUpdates: vi.fn(async () => ({ updateInfo: { version: '9.9.9' } })),
  downloadUpdate: vi.fn(async () => undefined),
  quitAndInstall: vi.fn(),
}

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '0.2.12',
    getPath: () => process.cwd(),
  },
}))
vi.mock('electron-updater', () => ({ default: { autoUpdater } }))

const original = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  autoUpdater.checkForUpdates.mockClear()
  autoUpdater.downloadUpdate.mockClear()
  autoUpdater.quitAndInstall.mockClear()
  delete (process as { windowsStore?: boolean }).windowsStore
  delete process.env.PATRIMO_CANAL
})

afterEach(() => {
  process.env = { ...original }
  delete (process as { windowsStore?: boolean }).windowsStore
})

describe('esCanalStore — dos capas, basta con que una diga que sí', () => {
  it('canal normal: ninguna señal puesta', async () => {
    const { esCanalStore } = await import('./actualizador')
    expect(esCanalStore()).toBe(false)
  })

  it('capa 1: process.windowsStore en runtime', async () => {
    ;(process as { windowsStore?: boolean }).windowsStore = true
    const { esCanalStore } = await import('./actualizador')
    expect(esCanalStore()).toBe(true)
  })

  it('capa 2: la constante congelada en tiempo de build', async () => {
    process.env.PATRIMO_CANAL = 'store'
    const { esCanalStore } = await import('./actualizador')
    expect(esCanalStore()).toBe(true)
  })

  it('la capa 2 sola basta aunque Electron no detecte el empaquetado', async () => {
    // Es justo el caso para el que existe la segunda capa: si
    // `process.windowsStore` fallara, el paquete de Store seguiría protegido.
    ;(process as { windowsStore?: boolean }).windowsStore = false
    process.env.PATRIMO_CANAL = 'store'
    const { esCanalStore } = await import('./actualizador')
    expect(esCanalStore()).toBe(true)
  })
})

describe('en el canal Store, electron-updater NUNCA se inicializa', () => {
  for (const [nombre, poner] of [
    ['por process.windowsStore', () => ((process as { windowsStore?: boolean }).windowsStore = true)],
    ['por PATRIMO_CANAL', () => (process.env.PATRIMO_CANAL = 'store')],
  ] as const) {
    it(`buscar() no contacta a GitHub — ${nombre}`, async () => {
      poner()
      const { buscar } = await import('./actualizador')
      await expect(buscar()).resolves.toEqual({ estado: 'sin-actualizacion' })
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    })

    it(`descargar() no descarga nada — ${nombre}`, async () => {
      poner()
      const { descargar } = await import('./actualizador')
      await expect(descargar()).resolves.toEqual({ estado: 'sin-actualizacion' })
      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
    })

    it(`instalarAhora() no reinicia la app — ${nombre}`, async () => {
      poner()
      const { instalarAhora } = await import('./actualizador')
      instalarAhora()
      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })
  }
})

describe('en el canal normal el actualizador sigue funcionando', () => {
  it('buscar() sí consulta y reporta la versión nueva', async () => {
    const { buscar } = await import('./actualizador')
    await expect(buscar()).resolves.toEqual({ estado: 'disponible', version: '9.9.9' })
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('descargar() sí descarga, y enciende la bandera ANTES (§2.1)', async () => {
    const { descargar } = await import('./actualizador')
    await expect(descargar()).resolves.toEqual({ estado: 'lista' })
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
    // El bug que costó un mes de updates rotos: la bandera tiene que estar
    // encendida cuando termina la descarga, no después.
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('instalarAhora() sí reinicia', async () => {
    const { instalarAhora } = await import('./actualizador')
    instalarAhora()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })
})
