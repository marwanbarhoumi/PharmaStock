/**
 * Internal HTTP client for the Inventory Service, the only owner of batches and
 * stock movements. Purchase never reads or writes Inventory collections.
 */
import { loadEnv } from '../config/env.js'
import { callService } from './internal-http.js'

export interface PurchaseBatchInput {
  medicineId: string
  batchNumber: string
  purchasePrice: number
  expirationDate: Date
}

export interface PurchaseMovementInput {
  medicineId: string
  batchId: string
  quantity: number
  reason: string
  referenceId: string
  performedBy: string
}

export interface BatchReference {
  _id: string
  batchNumber: string
  expirationDate: string
  quantity: number
  purchasePrice?: number
}

function inventory<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) {
  return callService<T>({
    service: 'Inventory Service',
    baseUrl: `${loadEnv().INVENTORY_SERVICE_URL}/internal/inventory`,
    method,
    path,
    body,
    internalToken: true,
  })
}

/** Creates the zero-quantity batch for a purchase line; returns its id. */
export async function createPurchaseBatch(input: PurchaseBatchInput): Promise<string> {
  const created = await inventory<{ id: string }>('POST', '/batches', {
    ...input,
    expirationDate: new Date(input.expirationDate).toISOString(),
  })
  return created.id
}

/** Compensation only: removes a batch created by a failed purchase creation. */
export async function deletePurchaseBatch(batchId: string): Promise<void> {
  await inventory('DELETE', `/batches/${batchId}`)
}

/** Purchase cancellation: deactivates the batch only if it never received stock. */
export async function deactivateBatchIfEmpty(batchId: string): Promise<void> {
  await inventory('POST', `/batches/${batchId}/deactivate-if-empty`)
}

/** PURCHASE movement: atomic batch increase + movement record, applied by Inventory. */
export async function applyPurchaseMovement(input: PurchaseMovementInput): Promise<void> {
  await inventory('POST', '/movements', {
    ...input,
    type: 'PURCHASE',
    referenceType: 'PURCHASE',
  })
}

export async function fetchBatchReferences(batchIds: string[]) {
  const data = await inventory<{ batches: BatchReference[] }>('POST', '/references', {
    medicineIds: [],
    batchIds,
    includePurchasePrice: true,
  })
  return data.batches
}
