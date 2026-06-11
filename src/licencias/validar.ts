/**
 * Validación criptográfica de licencias, 100% offline.
 *
 * Cadena de activación (lo que el usuario pega):
 *   {codigo}.{metaB64url}.{firmaB64url}
 *
 * - codigo:  PTRF-{PRO|PREM|LIFE}-{YYYY}-{8 hex}   (legible, va en el recibo)
 * - meta:    JSON base64url. Hoy solo { vence?: 'YYYY-MM-DD' } (Premium mensual).
 * - firma:   RSA-2048 SHA-256 (PKCS#1 v1.5) sobre `${codigo}.${metaB64url}`,
 *            generada por el script del dueño con la llave privada.
 *
 * Usa Web Crypto, disponible igual en el renderer de Electron y en Node,
 * así el módulo se prueba sin mocks.
 *
 * Filosofía: nunca hay bloqueo duro. Una licencia inválida o vencida solo
 * regresa un estado; la UI degrada a Free con un aviso amistoso.
 */

import type { Plan } from './planes'

const TIER_A_PLAN: Record<string, Plan> = {
  PRO: 'pro',
  PREM: 'premium',
  LIFE: 'lifetime',
}

const PATRON_CODIGO = /^PTRF-(PRO|PREM|LIFE)-(\d{4})-([0-9A-F]{8})$/

export interface MetaLicencia {
  /** Fecha ISO en que vence (solo Premium). */
  vence?: string
}

export type EstadoLicencia =
  | { estado: 'valida'; plan: Plan; codigo: string; vence?: string }
  | { estado: 'vencida'; plan: Plan; codigo: string; vencio: string }
  | { estado: 'invalida'; razon: 'malformada' | 'firma_invalida' }

function base64UrlADatos(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(b64)
  const datos = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) datos[i] = binario.charCodeAt(i)
  return datos
}

async function importarLlavePublica(pem: string): Promise<CryptoKey> {
  const cuerpo = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')
  const der = base64UrlADatos(cuerpo)
  return crypto.subtle.importKey(
    'spki',
    der.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

/**
 * Valida una cadena de activación contra la llave pública embebida.
 * `hoy` se inyecta (ISO YYYY-MM-DD) para mantener la función determinista.
 */
export async function validarLicencia(
  activacion: string,
  llavePublicaPem: string,
  hoy: string,
): Promise<EstadoLicencia> {
  // El usuario puede pegar con saltos de línea o espacios (correo, PDF).
  const limpia = activacion.replace(/\s+/g, '')
  const partes = limpia.split('.')
  if (partes.length !== 3) return { estado: 'invalida', razon: 'malformada' }
  const [codigo, metaB64, firmaB64] = partes as [string, string, string]

  const coincide = PATRON_CODIGO.exec(codigo)
  if (!coincide) return { estado: 'invalida', razon: 'malformada' }
  const plan = TIER_A_PLAN[coincide[1]!]!

  let meta: MetaLicencia
  try {
    meta = JSON.parse(new TextDecoder().decode(base64UrlADatos(metaB64)))
  } catch {
    return { estado: 'invalida', razon: 'malformada' }
  }

  let firmaValida = false
  try {
    const llave = await importarLlavePublica(llavePublicaPem)
    const firma = base64UrlADatos(firmaB64)
    const mensaje = new TextEncoder().encode(`${codigo}.${metaB64}`)
    firmaValida = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      llave,
      firma.buffer as ArrayBuffer,
      mensaje.buffer as ArrayBuffer,
    )
  } catch {
    return { estado: 'invalida', razon: 'firma_invalida' }
  }
  if (!firmaValida) return { estado: 'invalida', razon: 'firma_invalida' }

  if (meta.vence && meta.vence < hoy) {
    return { estado: 'vencida', plan, codigo, vencio: meta.vence }
  }
  return { estado: 'valida', plan, codigo, vence: meta.vence }
}

/** Plan efectivo a partir del estado: anomalías degradan a Free, nunca bloquean. */
export function planEfectivo(estado: EstadoLicencia | undefined): Plan {
  return estado?.estado === 'valida' ? estado.plan : 'free'
}
