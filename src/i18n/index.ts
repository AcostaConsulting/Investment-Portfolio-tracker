import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { es } from './es'
import { en } from './en'
import { fr } from './fr'
import { zh } from './zh'
import { ja } from './ja'
import type { Idioma } from '../state/documento'

export const IDIOMAS: { codigo: Idioma; nombre: string }[] = [
  { codigo: 'es', nombre: 'Español' },
  { codigo: 'en', nombre: 'English' },
  { codigo: 'fr', nombre: 'Français' },
  { codigo: 'zh', nombre: '简体中文' },
  { codigo: 'ja', nombre: '日本語' },
]

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr },
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
})

/** Cambio en vivo: react-i18next re-renderiza todo lo traducido al instante. */
export function cambiarIdioma(idioma: Idioma): void {
  void i18n.changeLanguage(idioma)
}

export default i18n
