import { describe, expect, it } from 'vitest'
import { esUrlPermitida } from './externo'
import {
  URL_CONSULTORIA,
  URL_CONTACTO,
  URL_PLAYLIST_VIDEOS,
  URLS_GUMROAD,
  VIDEOS_TUTORIALES,
} from '../config/planes'

describe('allowlist de links externos', () => {
  it('permite todas las URLs oficiales que la app abre', () => {
    for (const url of [
      ...Object.values(URLS_GUMROAD),
      URL_CONSULTORIA,
      URL_CONTACTO,
      URL_PLAYLIST_VIDEOS,
      ...VIDEOS_TUTORIALES.map((v) => v.url),
    ]) {
      expect(esUrlPermitida(url), url).toBe(true)
    }
  })

  it('la serie de tutoriales está completa y sin videos repetidos', () => {
    // Un copy-paste que repita un id pasaría desapercibido en la UI: doce
    // tarjetas distintas abriendo el mismo video.
    expect(VIDEOS_TUTORIALES).toHaveLength(12)
    expect(new Set(VIDEOS_TUTORIALES.map((v) => v.url)).size).toBe(12)
    expect(new Set(VIDEOS_TUTORIALES.map((v) => v.llave)).size).toBe(12)
  })

  it('rechaza hosts fuera de la lista, http y basura', () => {
    for (const url of [
      'https://youtube.com.evil.mx/playlist',
      'https://evil.mx/https://www.youtube.com',
      'http://www.youtube.com/playlist?list=X',
      'javascript:alert(1)',
      'no-es-una-url',
    ]) {
      expect(esUrlPermitida(url), url).toBe(false)
    }
  })
})
