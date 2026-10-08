import { Medicine } from '../models/index.js'

export interface LowStockAlertItem {
  medicineId: string
  medicineName: string
  medicineBarcode: string
  unit: string
  minimumStock: number
  totalQuantity: number
  deficit: number
}

/**
 * Computes available stock from active batch quantities and compares to minimumStock.
 * Does not create notifications.
 */
export async function findLowStockAlerts(): Promise<LowStockAlertItem[]> {
  const results = await Medicine.aggregate<{
    _id: { toString(): string }
    name: string
    barcode?: string
    unit: string
    minimumStock: number
    totalQuantity: number
  }>([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'batches',
        let: { medicineId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$medicine', '$$medicineId'] },
                  { $eq: ['$isActive', true] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$quantity' },
            },
          },
        ],
        as: 'stock',
      },
    },
    {
      $addFields: {
        totalQuantity: {
          $ifNull: [{ $arrayElemAt: ['$stock.totalQuantity', 0] }, 0],
        },
      },
    },
    {
      $match: {
        $expr: { $lt: ['$totalQuantity', '$minimumStock'] },
      },
    },
    {
      $project: {
        name: 1,
        barcode: 1,
        unit: 1,
        minimumStock: 1,
        totalQuantity: 1,
      },
    },
    { $sort: { name: 1 } },
  ])

  return results.map((item) => ({
    medicineId: String(item._id),
    medicineName: item.name,
    medicineBarcode: item.barcode ?? '',
    unit: item.unit,
    minimumStock: item.minimumStock,
    totalQuantity: item.totalQuantity,
    deficit: item.minimumStock - item.totalQuantity,
  }))
}
