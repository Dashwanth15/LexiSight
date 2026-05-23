import { useSettings } from './useSettings.jsx'
import { TRANSLATIONS } from '../data/translations.js'

export function useTranslation() {
  const { settings } = useSettings()
  const lang = settings.uiLanguage || 'en'

  const t = (key) => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key
  }

  return { t, currentLang: lang }
}
