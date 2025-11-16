import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import de from './locales/de.json'

const getSavedLocale = (): string => {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem('language')
  return saved || 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: getSavedLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    de
  }
})

export default i18n

