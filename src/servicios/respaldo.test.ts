import { describe, expect, it } from 'vitest'
import { deserializarRespaldo, serializarRespaldo } from './respaldo'
import { documentoInicial } from '../state/documento'

function docDePrueba() {
  const doc = documentoInicial()
  doc.activos.push({ id: 'a1', simbolo: 'AAPL', nombre: 'Apple', clase: 'accion', moneda: 'USD' })
  doc.operaciones.push({
    id: 'o1',
    activoId: 'a1',
    tipo: 'compra',
    fecha: '2026-01-10',
    cantidad: 10,
    precioUnitario: 200,
    moneda: 'USD',
    tipoCambio: 17,
  })
  return doc
}

describe('respaldo sin cifrar', () => {
  it('viaja ida y vuelta sin pérdida', async () => {
    const doc = docDePrueba()
    const texto = await serializarRespaldo(doc)
    const resultado = await deserializarRespaldo(texto)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.documento.operaciones).toEqual(doc.operaciones)
      expect(resultado.documento.activos).toEqual(doc.activos)
    }
  })

  it('rechaza archivos ajenos', async () => {
    expect((await deserializarRespaldo('{"cualquier":"json"}')).ok).toBe(false)
    expect((await deserializarRespaldo('no es json')).ok).toBe(false)
  })
})

describe('respaldo cifrado con PIN', () => {
  it('cifra y descifra con el PIN correcto', async () => {
    const doc = docDePrueba()
    const texto = await serializarRespaldo(doc, '1234')
    // El contenido no debe aparecer en claro
    expect(texto).not.toContain('AAPL')
    const resultado = await deserializarRespaldo(texto, '1234')
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.documento.activos[0]?.simbolo).toBe('AAPL')
  })

  it('PIN equivocado falla sin revelar nada', async () => {
    const texto = await serializarRespaldo(docDePrueba(), '1234')
    const resultado = await deserializarRespaldo(texto, '9999')
    expect(resultado).toEqual({ ok: false, error: 'pin_incorrecto' })
  })

  it('sin PIN pide el PIN en lugar de fallar como inválido', async () => {
    const texto = await serializarRespaldo(docDePrueba(), '1234')
    const resultado = await deserializarRespaldo(texto)
    expect(resultado).toEqual({ ok: false, error: 'pin_requerido' })
  })

  it('un respaldo alterado no descifra', async () => {
    const texto = await serializarRespaldo(docDePrueba(), '1234')
    const json = JSON.parse(texto) as { datos: string }
    json.datos = json.datos.slice(0, -8) + 'AAAAAAAA'
    const resultado = await deserializarRespaldo(JSON.stringify(json), '1234')
    expect(resultado).toEqual({ ok: false, error: 'pin_incorrecto' })
  })
})
