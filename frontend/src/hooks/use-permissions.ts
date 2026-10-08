import { useMemo } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { canAccessReports } from '@/lib/report-access'
import type { UserRole } from '@/types/auth'

const WRITE_INVENTORY: UserRole[] = ['ADMIN', 'PHARMACIST']
const CANCEL_SALE: UserRole[] = ['ADMIN', 'PHARMACIST']
const PURCHASES: UserRole[] = ['ADMIN', 'PHARMACIST']
const ALERT_CHECK: UserRole[] = ['ADMIN', 'PHARMACIST']

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role

  return useMemo(
    () => ({
      role,
      canWriteInventory: !!role && WRITE_INVENTORY.includes(role),
      canCreateSale: !!role,
      canCancelSale: !!role && CANCEL_SALE.includes(role),
      canManagePurchases: !!role && PURCHASES.includes(role),
      canRunAlertCheck: !!role && ALERT_CHECK.includes(role),
      canViewReports: canAccessReports(role),
    }),
    [role],
  )
}
