import type { ReactNode } from 'react'

import { AppShell } from '@/components/layout/app-shell'

interface RootLayoutProps {
  children: ReactNode
}

export function RootLayout({ children }: RootLayoutProps) {
  return <AppShell>{children}</AppShell>
}
