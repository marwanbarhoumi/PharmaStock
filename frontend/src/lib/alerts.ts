export type ExpirationAlertItem = {
  medicineId: string
  medicineName: string
  medicineBarcode?: string
  batchId: string
  batchNumber: string
  quantity: number
  expirationDate: string
  daysUntilExpiration: number
  status: 'EXPIRED' | 'WARNING'
}

export type LowStockAlertItem = {
  medicineId: string
  medicineName: string
  medicineBarcode?: string
  unit?: string
  minimumStock: number
  totalQuantity: number
  deficit: number
}

export type AlertsSnapshot = {
  warningDays: number
  expiration: {
    warningDays: number
    items: ExpirationAlertItem[]
  }
  lowStock: {
    items: LowStockAlertItem[]
  }
}

export type AlertsApiPayload = {
  warningDays?: number
  expiration?:
    | ExpirationAlertItem[]
    | { warningDays?: number; items?: ExpirationAlertItem[] }
  lowStock?: LowStockAlertItem[] | { items?: LowStockAlertItem[] }
}

/** Normalize `/alerts` payload so UI never crashes on shape mismatches. */
export function normalizeAlertsSnapshot(
  payload: AlertsApiPayload | null | undefined,
): AlertsSnapshot {
  const warningDays = payload?.warningDays ?? 30
  const expirationRaw = payload?.expiration
  const lowStockRaw = payload?.lowStock

  const expirationItems = Array.isArray(expirationRaw)
    ? expirationRaw
    : Array.isArray(expirationRaw?.items)
      ? expirationRaw.items
      : []

  const lowStockItems = Array.isArray(lowStockRaw)
    ? lowStockRaw
    : Array.isArray(lowStockRaw?.items)
      ? lowStockRaw.items
      : []

  return {
    warningDays,
    expiration: {
      warningDays:
        !Array.isArray(expirationRaw) && typeof expirationRaw?.warningDays === 'number'
          ? expirationRaw.warningDays
          : warningDays,
      items: expirationItems,
    },
    lowStock: {
      items: lowStockItems,
    },
  }
}
