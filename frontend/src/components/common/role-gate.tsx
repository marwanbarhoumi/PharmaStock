import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { useLocale } from '@/contexts/locale-context'
import type { TranslationKey } from '@/i18n'
import type { UserRole } from '@/types/auth'

interface RoleGateProps {
  allow: UserRole[]
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
  /** Localized message when access is denied (defaults to common.forbidden). */
  messageKey?: TranslationKey
}

export function RoleGate({
  allow,
  children,
  fallback,
  redirectTo,
  messageKey = 'common.forbidden',
}: RoleGateProps) {
  const { user, isLoading } = useAuth()
  const { t } = useLocale()

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    )
  }

  if (!user || !allow.includes(user.role)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />
    }
    return (
      fallback ?? (
        <section className="flex flex-1 flex-col gap-4">
          <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
            {t(messageKey)}
          </div>
        </section>
      )
    )
  }

  return children
}
