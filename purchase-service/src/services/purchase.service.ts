import { Types, type QueryFilter } from 'mongoose'

import {
  Purchase,
  PurchaseItem,
  Supplier,
  type PurchaseDocument,
} from '../models/index.js'
import type {
  CreatePurchaseInput,
  PurchaseListQuery,
} from '../schemas/purchase.schema.js'
import { badRequest, conflict, notFound } from '../utils/app-error.js'
import { buildDocumentNumber } from '../utils/document-number.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch } from '../utils/query-builder.js'
import { ServiceCallError } from './internal-http.js'
import {
  applyPurchaseMovement,
  createPurchaseBatch,
  deactivateBatchIfEmpty,
  deletePurchaseBatch,
} from './inventory-client.js'
import { getActiveMedicine } from './medicine-client.js'
import { hydratePurchaseReferences } from './purchase-references.js'

const PURCHASE_SORT_FIELDS = [
  'purchaseDate',
  'createdAt',
  'total',
  'purchaseNumber',
] as const

export async function getPurchases(query: PurchaseListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(
    query.sort,
    query.order,
    PURCHASE_SORT_FIELDS,
    'purchaseDate',
  )

  const filter: QueryFilter<PurchaseDocument> = {
    ...buildTextSearch<PurchaseDocument>(query.search, ['purchaseNumber']),
  }

  if (query.status) {
    filter.status = query.status
  }
  if (query.supplier) {
    filter.supplier = query.supplier
  }
  if (query.purchasedBy) {
    filter.purchasedBy = query.purchasedBy
  }

  const [items, total] = await Promise.all([
    Purchase.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('supplier', 'name phone email')
      .populate('purchasedBy', 'firstName lastName email')
      .populate('items')
      .lean(),
    Purchase.countDocuments(filter),
  ])

  return {
    items: await hydratePurchaseReferences(items, 'list'),
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getPurchaseById(id: string) {
  const purchase = await Purchase.findById(id)
    .populate('supplier', 'name phone email address contactPerson')
    .populate('purchasedBy', 'firstName lastName email role')
    .populate('items')
    .lean()

  if (!purchase) {
    throw notFound('Purchase')
  }

  const [hydrated] = await hydratePurchaseReferences([purchase], 'detail')
  return hydrated!
}

async function assertSupplierActive(supplierId: string): Promise<void> {
  const supplier = await Supplier.findById(supplierId).select('_id isActive')
  if (!supplier || supplier.isActive === false) {
    throw notFound('Supplier')
  }
}

async function nextFreePurchaseNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildDocumentNumber('PUR')
    if (!(await Purchase.exists({ purchaseNumber: candidate }))) {
      return candidate
    }
  }
  throw conflict('Unable to create purchase')
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}

function isUnknownOutcome(error: unknown): boolean {
  return error instanceof ServiceCallError && error.outcome === 'unknown'
}

interface PreparedLine {
  medicineId: string
  batchId: string
  quantity: number
  unitPrice: number
}

async function persistPurchase(
  purchaseId: Types.ObjectId,
  purchaseNumber: string,
  input: CreatePurchaseInput,
  lines: PreparedLine[],
  purchasedBy: string,
): Promise<void> {
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const total = Math.max(0, subtotal - input.discount + input.tax)
  const status = input.receiveNow ? 'RECEIVED' : 'PENDING'

  const itemDocs = await PurchaseItem.insertMany(
    lines.map((line) => ({
      purchase: purchaseId,
      medicine: line.medicineId,
      batch: line.batchId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.quantity * line.unitPrice,
    })),
  )

  let number = purchaseNumber
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const payload = {
        _id: purchaseId,
        purchaseNumber: number,
        supplier: input.supplierId,
        items: itemDocs.map((doc) => String(doc._id)),
        subtotal,
        discount: input.discount,
        tax: input.tax,
        total,
        status: status as 'PENDING' | 'RECEIVED',
        purchasedBy,
        purchaseDate: new Date(),
      }
      await new Purchase(payload).save()
      if (number !== purchaseNumber) {
        console.warn(
          `[purchase] number ${purchaseNumber} was taken concurrently; purchase ` +
            `${String(purchaseId)} saved as ${number}`,
        )
      }
      return
    } catch (error) {
      if (!isDuplicateKey(error) || attempt === 4) {
        throw error
      }
      number = buildDocumentNumber('PUR')
    }
  }
}

/**
 * Creates a purchase without a cross-service transaction:
 * 1. validate supplier (owned here) and medicines (Medicine Service);
 * 2. create one zero-quantity batch per line in Inventory (+ PURCHASE movement when receiveNow);
 * 3. persist PurchaseItems + Purchase.
 * Any failure removes the purchase items and the batches created so far.
 * A batch creation with an unknown outcome (timeout) is logged for reconciliation.
 */
export async function createPurchase(input: CreatePurchaseInput, purchasedBy: string) {
  await assertSupplierActive(input.supplierId)

  if (input.items.length === 0) {
    throw badRequest('At least one purchase item is required')
  }

  for (const medicineId of new Set(input.items.map((item) => item.medicineId))) {
    await getActiveMedicine(medicineId)
  }

  const purchaseId = new Types.ObjectId()
  const purchaseNumber = await nextFreePurchaseNumber()
  const createdBatchIds: string[] = []
  const stockedBatchIds = new Set<string>()
  const lines: PreparedLine[] = []

  try {
    for (const item of input.items) {
      let batchId: string
      try {
        batchId = await createPurchaseBatch({
          medicineId: item.medicineId,
          batchNumber: item.batchNumber,
          purchasePrice: item.unitPrice,
          expirationDate: item.expirationDate,
        })
      } catch (error) {
        if (isUnknownOutcome(error)) {
          console.error(
            `[purchase] RECONCILE purchase ${purchaseNumber} (${String(purchaseId)}): outcome ` +
              `unknown for batch ${item.batchNumber} of medicine ${item.medicineId}. Not retried; ` +
              'if it exists with quantity 0 it can be deleted.',
          )
        }
        throw error
      }
      createdBatchIds.push(batchId)

      if (input.receiveNow) {
        await applyPurchaseMovement({
          medicineId: item.medicineId,
          batchId,
          quantity: item.quantity,
          reason: `Purchase ${purchaseNumber}`,
          referenceId: String(purchaseId),
          performedBy: purchasedBy,
        })
        stockedBatchIds.add(batchId)
      }

      lines.push({
        medicineId: item.medicineId,
        batchId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })
    }

    await persistPurchase(purchaseId, purchaseNumber, input, lines, purchasedBy)
  } catch (error) {
    await PurchaseItem.deleteMany({ purchase: purchaseId }).catch((cleanupError: unknown) => {
      console.error(
        `[purchase] could not remove items of failed purchase ${String(purchaseId)}`,
        cleanupError,
      )
    })
    for (const batchId of createdBatchIds) {
      try {
        await deletePurchaseBatch(batchId)
        if (stockedBatchIds.has(batchId)) {
          console.warn(
            `[purchase] RECONCILE purchase ${purchaseNumber} (${String(purchaseId)}): batch ` +
              `${batchId} removed after its PURCHASE movement was recorded; the movement ` +
              `(referenceId ${String(purchaseId)}) remains as history only.`,
          )
        }
      } catch (compensationError) {
        console.error(
          `[purchase] COMPENSATION FAILED for purchase ${purchaseNumber} (${String(purchaseId)}): ` +
            `could not remove batch ${batchId}. Manual cleanup required.`,
          compensationError,
        )
      }
    }
    throw error
  }

  return getPurchaseById(String(purchaseId))
}

/**
 * Receives a PENDING purchase once: increases batch stock and records PURCHASE movements.
 */
export async function receivePurchase(purchaseId: string, performedBy: string) {
  const claimed = await Purchase.findOneAndUpdate(
    { status: 'PENDING' },
    { $set: { status: 'RECEIVED' } },
    { returnDocument: 'before' },
  )
    .where('_id')
    .equals(purchaseId)
    .lean()

  if (!claimed) {
    const existing = await Purchase.findById(purchaseId).lean()
    if (!existing) {
      throw notFound('Purchase')
    }
    if (existing.status === 'RECEIVED') {
      throw conflict('Purchase is already received')
    }
    if (existing.status === 'CANCELLED') {
      throw conflict('Cancelled purchases cannot be received')
    }
    throw conflict('Purchase cannot be received')
  }

  const items = await PurchaseItem.find({ purchase: purchaseId }).lean()
  let receivedCount = 0

  try {
    for (const item of items) {
      await applyPurchaseMovement({
        medicineId: String(item.medicine),
        batchId: String(item.batch),
        quantity: item.quantity,
        reason: `Receive purchase ${claimed.purchaseNumber}`,
        referenceId: purchaseId,
        performedBy,
      })
      receivedCount += 1
    }
  } catch (error) {
    if (receivedCount === 0 && !isUnknownOutcome(error)) {
      try {
        await Purchase.findByIdAndUpdate(purchaseId, { $set: { status: 'PENDING' } })
      } catch (revertError) {
        console.error(
          `[purchase] RECONCILE purchase ${claimed.purchaseNumber} (${purchaseId}): no stock was ` +
            'received but the purchase could not be reverted to PENDING.',
          revertError,
        )
      }
    } else {
      // Keep RECEIVED so a retry cannot add the already-received lines twice.
      const failing = items[receivedCount]
      console.error(
        `[purchase] PARTIAL RECEIVE for purchase ${claimed.purchaseNumber} (${purchaseId}): ` +
          `${receivedCount}/${items.length} line(s) received before failure` +
          (failing && isUnknownOutcome(error)
            ? `; outcome unknown for batch ${String(failing.batch)} (${failing.quantity} unit(s)), ` +
              `check stock_movements with referenceId ${purchaseId}`
            : '') +
          '. Purchase kept RECEIVED; remaining lines need a manual stock adjustment.',
        error,
      )
    }
    throw error
  }

  return getPurchaseById(purchaseId)
}

/**
 * Cancels a PENDING purchase once. No stock is touched: its zero-quantity
 * batches are deactivated only if they are still empty.
 */
export async function cancelPurchase(purchaseId: string) {
  const claimed = await Purchase.findOneAndUpdate(
    { status: 'PENDING' },
    { $set: { status: 'CANCELLED' } },
    { returnDocument: 'before' },
  )
    .where('_id')
    .equals(purchaseId)
    .lean()

  if (!claimed) {
    const existing = await Purchase.findById(purchaseId).lean()
    if (!existing) {
      throw notFound('Purchase')
    }
    if (existing.status === 'CANCELLED') {
      throw conflict('Purchase is already cancelled')
    }
    if (existing.status === 'RECEIVED') {
      throw conflict('Received purchases cannot be cancelled')
    }
    throw conflict('Purchase cannot be cancelled')
  }

  const items = await PurchaseItem.find({ purchase: purchaseId }).lean()
  const failedBatches: string[] = []
  let firstError: unknown = null

  for (const item of items) {
    try {
      await deactivateBatchIfEmpty(String(item.batch))
    } catch (error) {
      failedBatches.push(String(item.batch))
      firstError ??= error
    }
  }

  if (firstError) {
    console.error(
      `[purchase] PARTIAL CANCEL for purchase ${claimed.purchaseNumber} (${purchaseId}): ` +
        `could not deactivate batch(es) ${failedBatches.join(', ')}. Purchase kept CANCELLED; ` +
        'deactivate-if-empty is safe to repeat manually.',
    )
    throw firstError
  }

  return getPurchaseById(purchaseId)
}
