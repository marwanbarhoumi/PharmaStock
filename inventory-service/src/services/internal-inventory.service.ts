import { Batch, Medicine } from '../models/index.js'
import { conflict, notFound } from '../utils/app-error.js'

export interface CreatePurchaseBatchInput {
  medicineId: string
  batchNumber: string
  purchasePrice: number
  expirationDate: Date
}

/**
 * Creates the zero-quantity batch used by a purchase line.
 * Mirrors the monolith purchase flow: stock is only added later by a PURCHASE movement.
 */
export async function createPurchaseBatch(input: CreatePurchaseBatchInput) {
  const medicine = await Medicine.findById(input.medicineId)
    .select('_id isActive')
    .lean()

  if (!medicine || medicine.isActive === false) {
    throw notFound('Medicine')
  }

  const duplicate = await Batch.findOne({})
    .where('medicine')
    .equals(input.medicineId)
    .where('batchNumber')
    .equals(input.batchNumber)
    .select('_id')
    .lean()

  if (duplicate) {
    throw conflict(
      `Batch number ${input.batchNumber} already exists for this medicine`,
    )
  }

  const batch = await Batch.create({
    medicine: input.medicineId,
    batchNumber: input.batchNumber,
    quantity: 0,
    purchasePrice: input.purchasePrice,
    expirationDate: input.expirationDate,
    receivedDate: new Date(),
    isActive: true,
  })

  return {
    id: String(batch._id),
    batchNumber: batch.batchNumber,
    quantity: batch.quantity,
  }
}

/** Compensation for a failed purchase creation: removes the batch it created. */
export async function deletePurchaseBatch(batchId: string) {
  const deleted = await Batch.findByIdAndDelete(batchId).lean()
  return { id: batchId, deleted: Boolean(deleted) }
}

/**
 * Display fields for notification/sale/purchase references, matching the monolith
 * populate selections ('name barcode' and 'batchNumber expirationDate quantity',
 * plus 'purchasePrice' when requested).
 */
export async function getReferences(
  medicineIds: string[],
  batchIds: string[],
  includePurchasePrice = false,
) {
  const batchFields = includePurchasePrice
    ? 'batchNumber expirationDate quantity purchasePrice'
    : 'batchNumber expirationDate quantity'
  const [medicines, batches] = await Promise.all([
    medicineIds.length
      ? Medicine.find({}).where('_id').in(medicineIds).select('name barcode').lean()
      : Promise.resolve([]),
    batchIds.length
      ? Batch.find({})
          .where('_id')
          .in(batchIds)
          .select(batchFields)
          .lean()
      : Promise.resolve([]),
  ])
  return { medicines, batches }
}

/** Purchase cancellation: deactivates the batch only if it never received stock. */
export async function deactivateBatchIfEmpty(batchId: string) {
  const updated = await Batch.findOneAndUpdate(
    { quantity: 0 },
    { $set: { isActive: false } },
    { returnDocument: 'after' },
  )
    .where('_id')
    .equals(batchId)
    .lean()

  return { id: batchId, deactivated: Boolean(updated) }
}
