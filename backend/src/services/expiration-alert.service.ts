import { Batch } from '../models/index.js'

export interface ExpirationAlertItem {
  medicineId: string
  medicineName: string
  medicineBarcode: string
  batchId: string
  batchNumber: string
  quantity: number
  expirationDate: Date
  daysUntilExpiration: number
  status: 'EXPIRED' | 'WARNING'
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

function daysBetweenUtc(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((to.getTime() - from.getTime()) / msPerDay)
}

/**
 * Finds active batches that are expired or within the warning window.
 * Does not create notifications.
 */
export async function findExpirationAlerts(
  warningDays: number,
): Promise<ExpirationAlertItem[]> {
  const today = startOfUtcDay()
  const warningUntil = new Date(today)
  warningUntil.setUTCDate(warningUntil.getUTCDate() + warningDays)

  const batches = await Batch.find({
    isActive: true,
    quantity: { $gt: 0 },
    expirationDate: { $lte: warningUntil },
  })
    .populate('medicine', 'name barcode isActive')
    .sort({ expirationDate: 1, _id: 1 })
    .lean()

  const items: ExpirationAlertItem[] = []

  for (const batch of batches) {
    const medicine = batch.medicine as unknown as {
      _id: { toString(): string }
      name?: string
      barcode?: string
      isActive?: boolean
    } | null

    if (!medicine || medicine.isActive === false) {
      continue
    }

    const expirationDate = new Date(batch.expirationDate)
    const daysUntilExpiration = daysBetweenUtc(today, startOfUtcDay(expirationDate))
    const status: 'EXPIRED' | 'WARNING' =
      daysUntilExpiration < 0 ? 'EXPIRED' : 'WARNING'

    items.push({
      medicineId: String(medicine._id),
      medicineName: medicine.name ?? '',
      medicineBarcode: medicine.barcode ?? '',
      batchId: String(batch._id),
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expirationDate,
      daysUntilExpiration,
      status,
    })
  }

  return items
}
