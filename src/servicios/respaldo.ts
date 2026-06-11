/**
 * Respaldo y restauración a archivo JSON, con cifrado opcional por PIN.
 *
 * Formato cifrado: AES-256-GCM con llave derivada del PIN vía PBKDF2
 * (SHA-256, 150,000 iteraciones, salt aleatorio). Sin el PIN no hay
 * recuperación posible — eso se le advierte al usuario.
 */

import type { DocumentoStore } from '../state/documento'
import { migrarDocumento } from '../state/documento'

export interface RespaldoCifrado {
  formato: 'tracker-portafolio-respaldo'
  cifrado: true
  salt: string
  iv: string
  datos: string
}

export interface RespaldoPlano {
  formato: 'tracker-portafolio-respaldo'
  cifrado: false
  documento: unknown
}

const ITERACIONES = 150_000

function aB64(bytes: Uint8Array): string {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

function deB64(b64: string): Uint8Array {
  const binario = atob(b64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

async function derivarLlave(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERACIONES, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function serializarRespaldo(doc: DocumentoStore, pin?: string): Promise<string> {
  if (!pin) {
    const plano: RespaldoPlano = { formato: 'tracker-portafolio-respaldo', cifrado: false, documento: doc }
    return JSON.stringify(plano, null, 2)
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const llave = await derivarLlave(pin, salt)
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    llave,
    new TextEncoder().encode(JSON.stringify(doc)),
  )
  const respaldo: RespaldoCifrado = {
    formato: 'tracker-portafolio-respaldo',
    cifrado: true,
    salt: aB64(salt),
    iv: aB64(iv),
    datos: aB64(new Uint8Array(cifrado)),
  }
  return JSON.stringify(respaldo, null, 2)
}

export type ErrorRespaldo = 'invalido' | 'pin_requerido' | 'pin_incorrecto'

export async function deserializarRespaldo(
  texto: string,
  pin?: string,
): Promise<{ ok: true; documento: DocumentoStore } | { ok: false; error: ErrorRespaldo }> {
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    return { ok: false, error: 'invalido' }
  }
  const respaldo = crudo as {
    formato?: string
    cifrado?: boolean
    salt?: string
    iv?: string
    datos?: string
    documento?: unknown
  }
  if (respaldo.formato !== 'tracker-portafolio-respaldo') return { ok: false, error: 'invalido' }

  if (!respaldo.cifrado) {
    return { ok: true, documento: migrarDocumento(respaldo.documento) }
  }
  if (!pin) return { ok: false, error: 'pin_requerido' }
  if (!respaldo.salt || !respaldo.iv || !respaldo.datos) return { ok: false, error: 'invalido' }
  try {
    const llave = await derivarLlave(pin, deB64(respaldo.salt))
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deB64(respaldo.iv).buffer as ArrayBuffer },
      llave,
      deB64(respaldo.datos).buffer as ArrayBuffer,
    )
    return { ok: true, documento: migrarDocumento(JSON.parse(new TextDecoder().decode(claro))) }
  } catch {
    // GCM detecta llave equivocada o datos alterados por igual.
    return { ok: false, error: 'pin_incorrecto' }
  }
}

/** Texto UTF-8 → base64 (para mandar al diálogo de guardado del main). */
export function textoABase64(texto: string): string {
  return aB64(new TextEncoder().encode(texto))
}

export function base64ATexto(b64: string): string {
  return new TextDecoder().decode(deB64(b64))
}
