// Genera build/icon.ico (256x256) sin dependencias: un PNG dibujado a mano
// (papel + barras rosa mexicano + regla doble contable) envuelto en ICO.
// Se corre una vez; el resultado va al repo.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const TAM = 256

// Paleta "Libro Mayor"
const PAPEL = [0xf5, 0xef, 0xe3, 255]
const TINTA = [0x23, 0x1f, 0x17, 255]
const ROSA = [0xc4, 0x0f, 0x63, 255]

// Lienzo RGBA
const pix = new Uint8Array(TAM * TAM * 4)
function rect(x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * TAM + x) * 4
      pix[i] = color[0]
      pix[i + 1] = color[1]
      pix[i + 2] = color[2]
      pix[i + 3] = color[3]
    }
  }
}

// Fondo papel con marco de tinta fino
rect(0, 0, TAM, TAM, TINTA)
rect(6, 6, TAM - 6, TAM - 6, PAPEL)

// Tres barras ascendentes en rosa mexicano
rect(40, 150, 88, 196, ROSA)
rect(104, 108, 152, 196, ROSA)
rect(168, 56, 216, 196, ROSA)

// Regla doble contable bajo las barras
rect(28, 208, 228, 213, TINTA)
rect(28, 219, 228, 222, TINTA)

// ---------- PNG ----------
const tabla = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  tabla[n] = c
}
function crc32(buf) {
  let c = -1
  for (const b of buf) c = tabla[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(TAM, 0)
ihdr.writeUInt32BE(TAM, 4)
ihdr[8] = 8 // bits
ihdr[9] = 6 // RGBA

// Scanlines con filtro 0
const crudo = Buffer.alloc(TAM * (TAM * 4 + 1))
for (let y = 0; y < TAM; y++) {
  crudo[y * (TAM * 4 + 1)] = 0
  Buffer.from(pix.buffer, y * TAM * 4, TAM * 4).copy(crudo, y * (TAM * 4 + 1) + 1)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(crudo, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

// ---------- ICO (PNG embebido, válido desde Vista) ----------
const cabecera = Buffer.alloc(6)
cabecera.writeUInt16LE(0, 0) // reservado
cabecera.writeUInt16LE(1, 2) // tipo icono
cabecera.writeUInt16LE(1, 4) // 1 imagen
const entrada = Buffer.alloc(16)
entrada[0] = 0 // 256
entrada[1] = 0 // 256
entrada[4] = 1 // planos
entrada[6] = 32 // bpp
entrada.writeUInt32LE(png.length, 8)
entrada.writeUInt32LE(22, 12) // offset

mkdirSync('build', { recursive: true })
writeFileSync('build/icon.ico', Buffer.concat([cabecera, entrada, png]))
writeFileSync('build/icon.png', png)
console.log('✓ build/icon.ico y build/icon.png generados')
