import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n'
import { useLocale } from '@/contexts/locale-context'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="sr-only sm:not-sr-only">{t('nav.language')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        aria-label={t('nav.language')}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
