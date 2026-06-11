import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { planEfectivo, validarLicencia } from './validar'
import { planMinimoPara, tieneCapacidad } from './planes'

// Par de llaves efímero: los tests no dependen de la llave real del dueño.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
const llaveAjena = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

function emitir(tier: 'PRO' | 'PREM' | 'LIFE', meta: object = {}, llave = privateKey): string {
  const codigo = `PTRF-${tier}-2026-${randomBytes(4).toString('hex').toUpperCase()}`
  const metaB64 = Buffer.from(JSON.stringify(meta)).toString('base64url')
  const firma = sign('sha256', Buffer.from(`${codigo}.${metaB64}`), llave).toString('base64url')
  return `${codigo}.${metaB64}.${firma}`
}

const HOY = '2026-06-11'

describe('validarLicencia', () => {
  it('acepta una licencia Pro bien firmada', async () => {
    const estado = await validarLicencia(emitir('PRO'), publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'valida', plan: 'pro' })
  })

  it('acepta Lifetime sin vencimiento', async () => {
    const estado = await validarLicencia(emitir('LIFE'), publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'valida', plan: 'lifetime', vence: undefined })
  })

  it('Premium vigente regresa su fecha de vencimiento', async () => {
    const estado = await validarLicencia(emitir('PREM', { vence: '2026-07-11' }), publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'valida', plan: 'premium', vence: '2026-07-11' })
  })

  it('Premium vencida se reporta como vencida, no como inválida', async () => {
    const estado = await validarLicencia(emitir('PREM', { vence: '2026-05-01' }), publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'vencida', plan: 'premium', vencio: '2026-05-01' })
  })

  it('tolera espacios y saltos de línea al pegar', async () => {
    const activacion = emitir('PRO')
    const pegada = `  ${activacion.slice(0, 30)}\n${activacion.slice(30)}  \n`
    const estado = await validarLicencia(pegada, publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'valida', plan: 'pro' })
  })

  it('rechaza un código alterado (cambiar el tier rompe la firma)', async () => {
    const activacion = emitir('PRO').replace('PTRF-PRO-', 'PTRF-LIFE-')
    const estado = await validarLicencia(activacion, publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'invalida', razon: 'firma_invalida' })
  })

  it('rechaza una licencia firmada con otra llave privada', async () => {
    const estado = await validarLicencia(emitir('PRO', {}, llaveAjena.privateKey), publicKey, HOY)
    expect(estado).toMatchObject({ estado: 'invalida', razon: 'firma_invalida' })
  })

  it('rechaza basura y formatos incompletos como malformados', async () => {
    for (const basura of ['', 'hola', 'PTRF-PRO-2026-AAAA1111', 'a.b', 'PTRF-XXX-2026-AAAA1111.e30.firma']) {
      const estado = await validarLicencia(basura, publicKey, HOY)
      expect(estado.estado).toBe('invalida')
    }
  })

  it('planEfectivo degrada a free ante cualquier anomalía, sin bloquear', async () => {
    expect(planEfectivo(undefined)).toBe('free')
    expect(planEfectivo(await validarLicencia('basura', publicKey, HOY))).toBe('free')
    expect(planEfectivo(await validarLicencia(emitir('PREM', { vence: '2025-01-01' }), publicKey, HOY))).toBe('free')
    expect(planEfectivo(await validarLicencia(emitir('LIFE'), publicKey, HOY))).toBe('lifetime')
  })
})

describe('gating por plan', () => {
  it('Free importa Excel pero no exporta ni usa precios en vivo', () => {
    expect(tieneCapacidad('free', 'importarExcel')).toBe(true)
    expect(tieneCapacidad('free', 'exportarExcel')).toBe(false)
    expect(tieneCapacidad('free', 'preciosEnVivo')).toBe(false)
  })

  it('Pro desbloquea export y precios en vivo, pero no Premium', () => {
    expect(tieneCapacidad('pro', 'exportarExcel')).toBe(true)
    expect(tieneCapacidad('pro', 'preciosEnVivo')).toBe(true)
    expect(tieneCapacidad('pro', 'benchmarks')).toBe(false)
    expect(tieneCapacidad('pro', 'metas')).toBe(false)
  })

  it('Premium y Lifetime tienen todo', () => {
    for (const plan of ['premium', 'lifetime'] as const) {
      for (const cap of ['alertasPrecio', 'analisisComisiones', 'rebalanceo', 'benchmarks', 'metas'] as const) {
        expect(tieneCapacidad(plan, cap)).toBe(true)
      }
    }
  })

  it('planMinimoPara alimenta el aviso de upgrade correcto', () => {
    expect(planMinimoPara('importarExcel')).toBe('free')
    expect(planMinimoPara('exportarExcel')).toBe('pro')
    expect(planMinimoPara('rebalanceo')).toBe('premium')
  })
})
