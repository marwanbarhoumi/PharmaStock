/**
 * Internal HTTP client for the Inventory Service, the only owner of batches,
 * stock movements and FEFO. Sales never reads or writes Inventory collections.
 */
import { loadEnv } from '../config/env.js'
import type { StockMovementType } from '../types/enums.js'
import { callService } from './internal-http.js'

export interface FefoAllocationItem {
  batchId: string
  batchNumber: string
  expirationDate: string
  availableQuantity: number
  allocatedQuantity: number
}

export interface FefoAllocationPlan {
  medicineId: string
  requestedQuantity: number
  allocatedQuantity: number
  allocations: FefoAllocationItem[]
}

export interface SaleMovementInput {
  medicineId: string
  batchId: string
  type: Extract<StockMovementType, 'SALE' | 'RETURN_IN'>
  quantity: number
  reason: string
  referenceId: string
  performedBy: string
}

export interface AppliedMovement {
  movement: { id: string; previousQuantity: number; newQuantity: number }
  batch: { id: string; batchNumber: string; quantity: number }
}

export interface BatchReference {
  _id: string
  batchNumber: string
  expirationDate: string
  quantity: number
}

function inventory<T>(method: 'GET' | 'POST', path: string, body?: unknown) {
  return callService<T>({
    service: 'Inventory Service',
    baseUrl: `${loadEnv().INVENTORY_SERVICE_URL}/internal/inventory`,
    method,
    path,
    body,
    internalToken: true,
  })
}

/** Read-only FEFO plan computed by Inventory (no stock change). */
export function allocateStock(medicineId: string, quantity: number) {
  return inventory<FefoAllocationPlan>('POST', '/fefo/allocate', { medicineId, quantity })
}

/** Atomic guarded stock change + movement record, applied by Inventory. */
export function applyMovement(input: SaleMovementInput) {
  return inventory<AppliedMovement>('POST', '/movements', {
    ...input,
    referenceType: 'SALE',
  })
}

/** Batch display fields (batchNumber, expirationDate, quantity) by id. */
export async function fetchBatchReferences(batchIds: string[]) {
  const data = await inventory<{ batches: BatchReference[] }>('POST', '/references', {
    medicineIds: [],
    batchIds,
  })
  return data.batches
}
