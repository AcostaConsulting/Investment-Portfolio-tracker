/* Pantalla Ayuda — se completa en S2-B8 (stub para mantener el build verde). */

import { useTranslation } from 'react-i18next'

export function Ayuda() {
  const { t } = useTranslation()
  return (
    <div className="vista">
      <div className="vista-cabecera">
        <h1>{t('nav.ayuda')}</h1>
      </div>
    </div>
  )
}
