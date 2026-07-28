import { describe, expect, it } from 'vitest'
import { esUrlPermitida } from './externo'
import { URL_CONSULTORIA, URL_CONTACTO, URL_PLAYLIST_VIDEOS, URLS_GUMROAD } from '../config/planes'

describe('allowlist de links externos', () => {
  it('permite todas las URLs oficiales que la app abre', () => {
    for (const url of [...Object.values(URLS_GUMROAD), URL_CONSULTORIA, URL_CONTACTO, URL_PLAYLIST_VIDEOS]) {
      expect(esUrlPermitida(url), url).toBe(true)
    }
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
