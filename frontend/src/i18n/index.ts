import { ar } from './locales/ar'
import { fr } from './locales/fr'
import type { Locale, TranslationDictionary, TranslationKey } from './types'
import { LOCALES } from './types'

export type { Locale, TranslationDictionary, TranslationKey }
export { LOCALES }

export const DEFAULT_LOCALE: Locale = 'fr'

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
}

export const dictionaries: Record<Locale, TranslationDictionary> = {
  fr,
  ar,
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'fr' || value === 'ar'
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = dictionaries[locale][key] ?? dictionaries.fr[key] ?? key
  if (!params) {
    return template
  }

  return Object.entries(params).reduce(
    (text, [name, value]) =>
      text.replaceAll(`{${name}}`, String(value)),
    template,
  )
}
