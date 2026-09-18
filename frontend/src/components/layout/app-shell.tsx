import { Pill } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/common/theme-toggle'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, user, logout, isLoading } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to={isAuthenticated ? '/' : '/login'}
            className="flex items-center gap-3"
          >
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Pill className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">PharmaStock</p>
              <p className="text-xs text-muted-foreground">
                Pharmacy inventory foundation
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {!isLoading && isAuthenticated ? (
              <>
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-medium text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-muted-foreground">{user?.role}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={logout}>
                  Log out
                </Button>
              </>
            ) : !isLoading ? (
              <>
                <Link
                  to="/login"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  Register
                </Link>
              </>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  )
}
