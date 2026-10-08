/**
 * Internal HTTP client for the Inventory Service (source of truth for alerts,
 * batches and stock). Notification Service never reads Inventory collections.
 */
import { loadEnv } from '../config/env.js'
import { AppError } from '../utils/app-error.js'

export interface ExpirationAlertItem {
  medicineId: string
  medicineName: string
  medicineBarcode: string
  batchId: string
  batchNumber: string
  quantity: number
  expirationDate: string
  daysUntilExpiration: number
  status: 'EXPIRED' | 'WARNING'
}

export interface LowStockAlertItem {
  medicineId: string
  medicineName: string
  medicineBarcode: string
  unit: string
  minimumStock: number
  totalQuantity: number
  deficit: number
}

export interface InventoryAlertSnapshot {
  warningDays: number
  expiration: { warningDays: number; items: ExpirationAlertItem[] }
  lowStock: { items: LowStockAlertItem[] }
}

export interface MedicineReference {
  _id: string
  name: string
  barcode?: string
}

export interface BatchReference {
  _id: string
  batchNumber: string
  expirationDate: string
  quantity: number
}

export interface InventoryReferences {
  medicines: MedicineReference[]
  batches: BatchReference[]
}

async function callInventory<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const env = loadEnv()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (env.INTERNAL_API_TOKEN) {
    headers['x-internal-token'] = env.INTERNAL_API_TOKEN
  }

  let response: Response
  try {
    response = await fetch(`${env.INVENTORY_SERVICE_URL}/internal/inventory${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    console.error(`[notification] Inventory Service unreachable (${method} ${path})`, error)
    throw new AppError('Inventory Service unavailable', 503)
  }

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string
    data?: T
  }

  if (!response.ok || payload.data === undefined) {
    console.error(
      `[notification] Inventory Service error (${method} ${path}): ${response.status} ${payload.message ?? ''}`,
    )
    throw new AppError('Inventory Service unavailable', 503)
  }

  return payload.data
}

export function fetchAlertSnapshot(warningDays: number): Promise<InventoryAlertSnapshot> {
  return callInventory<InventoryAlertSnapshot>(
    'GET',
    `/alerts?warningDays=${encodeURIComponent(String(warningDays))}`,
  )
}

export function fetchReferences(
  medicineIds: string[],
  batchIds: string[],
): Promise<InventoryReferences> {
  return callInventory<InventoryReferences>('POST', '/references', {
    medicineIds,
    batchIds,
  })
}
