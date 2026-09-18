import { Batch, Medicine } from '../models/index.js'
import { badRequest, conflict, notFound } from '../utils/app-error.js'

export interface FefoAllocationItem {
  batchId: string
  batchNumber: string
  expirationDate: Date
  availableQuantity: number
  allocatedQuantity: number
}

export interface FefoAllocationPlan {
  medicineId: string
  requestedQuantity: number
  allocatedQuantity: number
  allocations: FefoAllocationItem[]
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

export async function allocateByFefo(
  medicineId: string,
  quantity: number,
): Promise<FefoAllocationPlan> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw badRequest('Quantity must be a positive number')
  }
  if (!Number.isInteger(quantity)) {
    throw badRequest('Quantity must be an integer')
  }

  const medicine = await Medicine.findById(medicineId).select('_id isActive')
  if (!medicine || medicine.isActive === false) {
    throw notFound('Medicine')
  }

  const today = startOfUtcDay()

  const batches = await Batch.find({
    medicine: medicineId,
    isActive: true,
    quantity: { $gt: 0 },
    expirationDate: { $gte: today },
  })
    .sort({ expirationDate: 1, _id: 1 })
    .select('_id batchNumber expirationDate quantity')
    .lean()

  let remaining = quantity
  const allocations: FefoAllocationItem[] = []

  for (const batch of batches) {
    if (remaining <= 0) {
      break
    }

    const take = Math.min(batch.quantity, remaining)
    if (take <= 0) {
      continue
    }

    allocations.push({
      batchId: String(batch._id),
      batchNumber: batch.batchNumber,
      expirationDate: batch.expirationDate,
      availableQuantity: batch.quantity,
      allocatedQuantity: take,
    })
    remaining -= take
  }

  if (remaining > 0) {
    throw conflict(
      `Insufficient eligible stock for FEFO allocation. Missing ${remaining} unit(s).`,
    )
  }

  return {
    medicineId,
    requestedQuantity: quantity,
    allocatedQuantity: quantity,
    allocations,
  }
}
