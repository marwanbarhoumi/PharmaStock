import { CheckCircle2 } from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'

export function HomePage() {
  const { user } = useAuth()

  return (
    <section className="flex flex-1 flex-col items-start justify-center gap-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          PharmaStock
        </h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          Welcome back, {user?.firstName}. Authentication is active.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        <span>
          Signed in as {user?.email} ({user?.role}).
        </span>
      </div>
    </section>
  )
}
