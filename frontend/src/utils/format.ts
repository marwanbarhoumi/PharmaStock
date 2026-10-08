import { useLocale } from '@/contexts/locale-context'

export function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value: string | undefined, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale === 'ar' ? 'ar' : 'fr-FR')
}

export function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale === 'ar' ? 'ar' : 'fr-FR')
}

export function namedRef(
  value: string | { name?: string; _id?: string } | null | undefined,
) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  return value.name ?? value._id ?? '—'
}

export function useFormatters() {
  const { locale } = useLocale()
  return {
    locale,
    money: (value: number) => formatMoney(value, locale),
    date: (value?: string) => formatDate(value, locale),
    dateTime: (value?: string) => formatDateTime(value, locale),
  }
}
