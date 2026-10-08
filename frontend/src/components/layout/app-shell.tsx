import { NavLink, Link } from 'react-router-dom'
import { Pill } from 'lucide-react'
import type { ReactNode } from 'react'

import { LanguageSwitcher } from '@/components/common/language-switcher'
import { ThemeToggle } from '@/components/common/theme-toggle'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  )

export function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, user, logout, isLoading } = useAuth()
  const { t } = useLocale()
  const { canManagePurchases, canViewReports } = usePermissions()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-sidebar print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              to={isAuthenticated ? '/' : '/login'}
              className="flex items-center gap-3"
            >
              <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Pill className="size-5" aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">PharmaStock</p>
                <p className="text-xs text-muted-foreground">{t('brand.tagline')}</p>
              </div>
            </Link>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <LanguageSwitcher />
              {!isLoading && isAuthenticated ? (
                <>
                  <div className="hidden text-end text-xs sm:block">
                    <p className="font-medium text-foreground">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-muted-foreground">{user?.role}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={logout}>
                    {t('nav.logOut')}
                  </Button>
                </>
              ) : !isLoading ? (
                <>
                  <Link
                    to="/login"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    {t('nav.signIn')}
                  </Link>
                  <Link
                    to="/register"
                    className={cn(buttonVariants({ size: 'sm' }))}
                  >
                    {t('nav.register')}
                  </Link>
                </>
              ) : null}
              <ThemeToggle />
            </div>
          </div>

          {!isLoading && isAuthenticated ? (
            <nav className="flex flex-wrap gap-2">
              <NavLink to="/" end className={navLinkClass}>
                {t('nav.dashboard')}
              </NavLink>
              <NavLink to="/medicines" className={navLinkClass}>
                {t('nav.medicines')}
              </NavLink>
              <NavLink to="/categories" className={navLinkClass}>
                {t('nav.categories')}
              </NavLink>
              <NavLink to="/suppliers" className={navLinkClass}>
                {t('nav.suppliers')}
              </NavLink>
              <NavLink to="/batches" className={navLinkClass}>
                {t('nav.batches')}
              </NavLink>
              <NavLink to="/stock" className={navLinkClass}>
                {t('nav.stock')}
              </NavLink>
              <NavLink to="/sales" className={navLinkClass}>
                {t('nav.sales')}
              </NavLink>
              {canManagePurchases ? (
                <NavLink to="/purchases" className={navLinkClass}>
                  {t('nav.purchases')}
                </NavLink>
              ) : null}
              <NavLink to="/notifications" className={navLinkClass}>
                {t('nav.notifications')}
              </NavLink>
              {canViewReports ? (
                <NavLink to="/reports" className={navLinkClass}>
                  {t('nav.reports')}
                </NavLink>
              ) : null}
              {isAdmin ? (
                <NavLink to="/audit-logs" className={navLinkClass}>
                  {t('nav.auditLogs')}
                </NavLink>
              ) : null}
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  )
}
