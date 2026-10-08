import type { ClientSession } from 'mongoose'

import { Batch, Medicine, StockMovement } from '../models/index.js'
import type { StockMovementType, StockReferenceType } from '../types/enums.js'
import { badRequest, conflict, notFound } from '../utils/app-error.js'
import { getStockDirection } from '../utils/stock-direction.js'
import { withOptionalTransaction } from '../utils/transaction.js'

export interface ApplyStockMovementInput {
  medicineId: string
  batchId: string
  type: StockMovementType
  quantity: number
  reason?: string
  referenceType?: StockReferenceType
  referenceId?: string | null
  performedBy: string
}

export interface AppliedStockMovement {
  movement: {
    id: string
    medicine: string
    batch: string
    type: StockMovementType
    quantity: number
    previousQuantity: number
    newQuantity: number
    reason: string
    referenceType: StockReferenceType
    referenceId: string | null
    performedBy: string
    createdAt?: Date
  }
  batch: {
    id: string
    batchNumber: string
    quantity: number
  }
  usedTransaction: boolean
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw badRequest('Quantity must be a positive number')
  }
  if (!Number.isInteger(quantity)) {
    throw badRequest('Quantity must be an integer')
  }
}

async function applyStockMovementInternal(
  input: ApplyStockMovementInput,
  session: ClientSession | null,
): Promise<Omit<AppliedStockMovement, 'usedTransaction'>> {
  assertPositiveQuantity(input.quantity)

  const direction = getStockDirection(input.type)
  const delta = direction === 'IN' ? input.quantity : -input.quantity

  const medicine = await Medicine.findById(input.medicineId)
    .select('_id isActive')
    .session(session)
    .lean()

  if (!medicine || medicine.isActive === false) {
    throw notFound('Medicine')
  }

  const existingBatch = await Batch.findById(input.batchId)
    .select('_id medicine isActive quantity batchNumber')
    .session(session)
    .lean()

  if (!existingBatch) {
    throw notFound('Batch')
  }
  if (existingBatch.isActive === false) {
    throw conflict('Batch is inactive')
  }
  if (String(existingBatch.medicine) !== input.medicineId) {
    throw badRequest('Batch does not belong to the specified medicine')
  }

  const updateQuery = Batch.findOneAndUpdate(
    { isActive: true },
    { $inc: { quantity: delta } },
    {
      returnDocument: 'before',
      ...(session ? { session } : {}),
    },
  )
    .where('_id')
    .equals(input.batchId)
    .where('medicine')
    .equals(input.medicineId)

  if (direction === 'OUT') {
    updateQuery.where('quantity').gte(input.quantity)
  }

  const previousBatch = await updateQuery.lean()

  if (!previousBatch) {
    if (direction === 'OUT') {
      throw conflict('Insufficient batch quantity for this movement')
    }
    throw conflict('Unable to update batch stock')
  }

  const previousQuantity = previousBatch.quantity
  const newQuantity = previousQuantity + delta

  if (newQuantity < 0) {
    if (!session) {
      await Batch.findByIdAndUpdate(input.batchId, {
        $inc: { quantity: -delta },
      })
    }
    throw conflict('Stock quantity cannot become negative')
  }

  try {
    const movementPayload = {
      medicine: input.medicineId,
      batch: input.batchId,
      type: input.type,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reason: input.reason ?? '',
      referenceType: input.referenceType ?? 'MANUAL',
      referenceId: input.referenceId ?? null,
      performedBy: input.performedBy,
    }

    const created = session
      ? (await StockMovement.create([movementPayload], { session }))[0]
      : await StockMovement.create(movementPayload)

    if (!created) {
      throw conflict('Failed to create stock movement record')
    }

    return {
      movement: {
        id: String(created._id),
        medicine: input.medicineId,
        batch: input.batchId,
        type: created.type as StockMovementType,
        quantity: created.quantity,
        previousQuantity: created.previousQuantity,
        newQuantity: created.newQuantity,
        reason: created.reason,
        referenceType: created.referenceType as StockReferenceType,
        referenceId: created.referenceId ? String(created.referenceId) : null,
        performedBy: input.performedBy,
        createdAt: created.createdAt,
      },
      batch: {
        id: String(previousBatch._id),
        batchNumber: previousBatch.batchNumber,
        quantity: newQuantity,
      },
    }
  } catch (error) {
    if (!session) {
      await Batch.findByIdAndUpdate(input.batchId, {
        $inc: { quantity: -delta },
      })
    }
    throw error
  }
}

export async function applyStockMovement(
  input: ApplyStockMovementInput,
): Promise<AppliedStockMovement> {
  const { result, usedTransaction } = await withOptionalTransaction((session) =>
    applyStockMovementInternal(input, session),
  )

  return {
    ...result,
    usedTransaction,
  }
}

/**
 * Applies a stock movement inside an already-open optional transaction session.
 * Callers that manage their own withOptionalTransaction should use this to avoid
 * nested sessions.
 */
export async function applyStockMovementInSession(
  input: ApplyStockMovementInput,
  session: ClientSession | null,
): Promise<Omit<AppliedStockMovement, 'usedTransaction'>> {
  return applyStockMovementInternal(input, session)
}
