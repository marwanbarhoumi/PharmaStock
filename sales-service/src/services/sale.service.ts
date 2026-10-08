import { Types, type QueryFilter } from 'mongoose'

import { Sale, SaleItem, type SaleDocument } from '../models/index.js'
import type { CreateSaleInput, SaleListQuery } from '../schemas/sale.schema.js'
import { badRequest, conflict, notFound } from '../utils/app-error.js'
import { buildDocumentNumber } from '../utils/document-number.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch } from '../utils/query-builder.js'
import { ServiceCallError } from './internal-http.js'
import { allocateStock, applyMovement } from './inventory-client.js'
import { getSellableMedicine } from './medicine-client.js'
import { hydrateSaleReferences } from './sale-references.js'

const SALE_SORT_FIELDS = ['createdAt', 'total', 'invoiceNumber'] as const

export async function getSales(query: SaleListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(query.sort, query.order, SALE_SORT_FIELDS, 'createdAt')

  const filter: QueryFilter<SaleDocument> = {
    ...buildTextSearch<SaleDocument>(query.search, [
      'invoiceNumber',
      'customerName',
      'customerPhone',
    ]),
  }

  if (query.status) {
    filter.status = query.status
  }
  if (query.soldBy) {
    filter.soldBy = query.soldBy
  }

  const [items, total] = await Promise.all([
    Sale.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('soldBy', 'firstName lastName email')
      .populate('items')
      .lean(),
    Sale.countDocuments(filter),
  ])

  return {
    items: await hydrateSaleReferences(items, 'list'),
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getSaleById(id: string) {
  const sale = await Sale.findById(id)
    .populate('soldBy', 'firstName lastName email role')
    .populate('items')
    .lean()

  if (!sale) {
    throw notFound('Sale')
  }

  const [hydrated] = await hydrateSaleReferences([sale], 'detail')
  return hydrated!
}

interface PreparedSaleLine {
  medicineId: string
  batchId: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

async function prepareSaleLines(
  items: CreateSaleInput['items'],
): Promise<{ lines: PreparedSaleLine[]; subtotal: number }> {
  const lines: PreparedSaleLine[] = []
  let subtotal = 0

  for (const item of items) {
    const medicine = await getSellableMedicine(item.medicineId)
    const plan = await allocateStock(item.medicineId, item.quantity)

    for (const allocation of plan.allocations) {
      const totalPrice = allocation.allocatedQuantity * medicine.sellingPrice
      subtotal += totalPrice
      lines.push({
        medicineId: item.medicineId,
        batchId: allocation.batchId,
        quantity: allocation.allocatedQuantity,
        unitPrice: medicine.sellingPrice,
        totalPrice,
      })
    }
  }

  return { lines, subtotal }
}

async function nextFreeInvoiceNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildDocumentNumber('SAL')
    if (!(await Sale.exists({ invoiceNumber: candidate }))) {
      return candidate
    }
  }
  throw conflict('Unable to create sale')
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

function describeLine(line: PreparedSaleLine): string {
  return `${line.quantity} unit(s) of medicine ${line.medicineId} on batch ${line.batchId}`
}

/**
 * Restores stock for SALE movements that Inventory confirmed. Each line is
 * attempted once; failures are logged for manual reconciliation, never retried.
 */
async function compensateAppliedLines(
  applied: PreparedSaleLine[],
  context: { saleId: string; invoiceNumber: string; soldBy: string },
): Promise<void> {
  for (const line of [...applied].reverse()) {
    try {
      await applyMovement({
        medicineId: line.medicineId,
        batchId: line.batchId,
        type: 'RETURN_IN',
        quantity: line.quantity,
        reason: `Rollback failed sale ${context.invoiceNumber}`,
        referenceId: context.saleId,
        performedBy: context.soldBy,
      })
    } catch (compensationError) {
      console.error(
        `[sale] COMPENSATION FAILED for sale ${context.invoiceNumber} (${context.saleId}): ` +
          `could not restore ${describeLine(line)}` +
          (isUnknownOutcome(compensationError)
            ? ' (outcome unknown: check stock_movements with referenceId before adjusting). '
            : '. ') +
          'Manual stock adjustment required.',
        compensationError,
      )
    }
  }
}

async function persistSale(
  saleId: Types.ObjectId,
  invoiceNumber: string,
  input: CreateSaleInput,
  lines: PreparedSaleLine[],
  subtotal: number,
  soldBy: string,
): Promise<void> {
  const itemDocs = await SaleItem.insertMany(
    lines.map((line) => ({
      sale: saleId,
      medicine: line.medicineId,
      batch: line.batchId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.totalPrice,
    })),
  )

  let number = invoiceNumber
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const payload = {
        _id: saleId,
        invoiceNumber: number,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        items: itemDocs.map((doc) => String(doc._id)),
        subtotal,
        discount: input.discount,
        tax: input.tax,
        total: Math.max(0, subtotal - input.discount + input.tax),
        paymentMethod: input.paymentMethod,
        status: 'COMPLETED' as const,
        soldBy,
      }
      await new Sale(payload).save()
      if (number !== invoiceNumber) {
        console.warn(
          `[sale] invoice ${invoiceNumber} was taken concurrently; sale ${String(saleId)} ` +
            `saved as ${number} (stock movements reference ${invoiceNumber})`,
        )
      }
      return
    } catch (error) {
      if (!isDuplicateKey(error) || attempt === 4) {
        throw error
      }
      number = buildDocumentNumber('SAL')
    }
  }
}

/**
 * Creates a sale without a cross-service transaction:
 * 1. validate medicines (Medicine Service) and build FEFO plans (Inventory, read-only);
 * 2. apply SALE movements one by one (Inventory, atomic guarded decrement);
 * 3. persist SaleItems + Sale.
 * Any failure after step 2 started restores confirmed lines with RETURN_IN.
 * A movement with an unknown outcome (timeout) is never retried or compensated.
 */
export async function createSale(input: CreateSaleInput, soldBy: string) {
  if (input.items.length === 0) {
    throw badRequest('At least one sale item is required')
  }

  const { lines, subtotal } = await prepareSaleLines(input.items)
  const saleId = new Types.ObjectId()
  const invoiceNumber = await nextFreeInvoiceNumber()
  const context = { saleId: String(saleId), invoiceNumber, soldBy }
  const applied: PreparedSaleLine[] = []

  for (const line of lines) {
    try {
      await applyMovement({
        medicineId: line.medicineId,
        batchId: line.batchId,
        type: 'SALE',
        quantity: line.quantity,
        reason: `Sale ${invoiceNumber}`,
        referenceId: context.saleId,
        performedBy: soldBy,
      })
      applied.push(line)
    } catch (error) {
      if (isUnknownOutcome(error)) {
        console.error(
          `[sale] RECONCILE sale ${invoiceNumber} (${context.saleId}): outcome unknown for SALE ` +
            `movement of ${describeLine(line)}. Not retried and not compensated; check ` +
            `stock_movements with referenceId ${context.saleId}. Sale was not created.`,
        )
      }
      await compensateAppliedLines(applied, context)
      throw error
    }
  }

  try {
    await persistSale(saleId, invoiceNumber, input, lines, subtotal, soldBy)
  } catch (error) {
    console.error(
      `[sale] persisting sale ${invoiceNumber} (${context.saleId}) failed after stock was ` +
        'consumed; restoring stock.',
      error,
    )
    await SaleItem.deleteMany({ sale: saleId }).catch((cleanupError: unknown) => {
      console.error(
        `[sale] could not remove sale items of failed sale ${context.saleId}`,
        cleanupError,
      )
    })
    await compensateAppliedLines(applied, context)
    throw error
  }

  return getSaleById(context.saleId)
}

/**
 * Cancels a COMPLETED sale and restores stock exactly once.
 * Uses an atomic status claim (COMPLETED → CANCELLED) to prevent double restore.
 */
export async function cancelSale(saleId: string, performedBy: string) {
  const claimed = await Sale.findOneAndUpdate(
    { status: 'COMPLETED' },
    { $set: { status: 'CANCELLED' } },
    { returnDocument: 'before' },
  )
    .where('_id')
    .equals(saleId)
    .lean()

  if (!claimed) {
    const existing = await Sale.findById(saleId).lean()
    if (!existing) {
      throw notFound('Sale')
    }
    if (existing.status === 'CANCELLED') {
      throw conflict('Sale is already cancelled')
    }
    throw conflict('Sale cannot be cancelled')
  }

  const items = await SaleItem.find({ sale: saleId }).lean()
  let restoredCount = 0

  try {
    for (const item of items) {
      await applyMovement({
        medicineId: String(item.medicine),
        batchId: String(item.batch),
        type: 'RETURN_IN',
        quantity: item.quantity,
        reason: `Cancel sale ${claimed.invoiceNumber}`,
        referenceId: saleId,
        performedBy,
      })
      restoredCount += 1
    }
  } catch (error) {
    if (restoredCount === 0 && !isUnknownOutcome(error)) {
      // Nothing was restored: revert the claim so a later retry can cancel.
      try {
        await Sale.findByIdAndUpdate(saleId, { $set: { status: 'COMPLETED' } })
      } catch (revertError) {
        console.error(
          `[sale] RECONCILE sale ${claimed.invoiceNumber} (${saleId}): no stock was restored ` +
            'but the sale could not be reverted to COMPLETED.',
          revertError,
        )
      }
    } else {
      // Some lines were (or may have been) restored. Keep the sale CANCELLED so
      // a retry cannot restore those lines twice; the remainder needs manual review.
      const failing = items[restoredCount]
      console.error(
        `[sale] PARTIAL CANCEL for sale ${claimed.invoiceNumber} (${saleId}): ` +
          `${restoredCount}/${items.length} line(s) restored before failure` +
          (failing && isUnknownOutcome(error)
            ? `; outcome unknown for line on batch ${String(failing.batch)} ` +
              `(${failing.quantity} unit(s)), check stock_movements with referenceId ${saleId}`
            : '') +
          '. Sale kept CANCELLED; remaining lines need a manual RETURN_IN adjustment.',
        error,
      )
    }
    throw error
  }

  return getSaleById(saleId)
}
