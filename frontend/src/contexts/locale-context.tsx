import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  DEFAULT_LOCALE,
  getDirection,
  isLocale,
  translate,
  type Locale,
  type TranslationKey,
} from '@/i18n'

const STORAGE_KEY = 'pharmastock-locale'

interface LocaleContextValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

function applyDocumentLocale(locale: Locale) {
  const root = document.documentElement
  root.lang = locale
  root.dir = getDirection(locale)
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    applyDocumentLocale(locale)
    window.localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  )

  const value = useMemo(
    () => ({
      locale,
      dir: getDirection(locale),
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}
