export const LOCALES = ['fr', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export type TranslationKey = keyof typeof import('./locales/fr').fr

export type TranslationDictionary = Record<TranslationKey, string>
