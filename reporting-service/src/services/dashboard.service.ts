import { loadEnv } from '../config/env.js'
import {
  Batch,
  Medicine,
  Purchase,
  Sale,
  SaleItem,
  StockMovement,
} from '../models/index.js'
import type { DashboardQuery } from '../schemas/report.schema.js'
import { badRequest } from '../utils/app-error.js'
import {
  endOfUtcDay,
  formatUtcDateKey,
  resolveDateRange,
  startOfUtcDay,
} from '../utils/date-range.js'

function getWarningDays(): number {
  return loadEnv().EXPIRATION_WARNING_DAYS
}

export async function getDashboardSummary(query: DashboardQuery) {
  let range
  try {
    range = resolveDateRange({
      from: query.from,
      to: query.to,
      defaultDays: 30,
    })
  } catch (error: unknown) {
    throw badRequest(error instanceof Error ? error.message : 'Invalid date range')
  }

  const today = startOfUtcDay(new Date())
  const warningDays = getWarningDays()
  const warningUntil = new Date(today)
  warningUntil.setUTCDate(warningUntil.getUTCDate() + warningDays)

  const [
    totalMedicines,
    stockAgg,
    lowStockAgg,
    expiredBatches,
    expiringSoonBatches,
    salesStats,
    purchaseStats,
    profitStats,
  ] = await Promise.all([
    Medicine.countDocuments({ isActive: true }),
    Medicine.aggregate<{ totalStockQuantity: number }>([
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
            { $group: { _id: null, qty: { $sum: '$quantity' } } },
          ],
          as: 'stock',
        },
      },
      {
        $group: {
          _id: null,
          totalStockQuantity: {
            $sum: { $ifNull: [{ $arrayElemAt: ['$stock.qty', 0] }, 0] },
          },
        },
      },
    ]),
    Medicine.aggregate<{ count: number }>([
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
            { $group: { _id: null, qty: { $sum: '$quantity' } } },
          ],
          as: 'stock',
        },
      },
      {
        $addFields: {
          totalQuantity: {
            $ifNull: [{ $arrayElemAt: ['$stock.qty', 0] }, 0],
          },
        },
      },
      { $match: { $expr: { $lt: ['$totalQuantity', '$minimumStock'] } } },
      { $count: 'count' },
    ]),
    Batch.countDocuments({
      isActive: true,
      quantity: { $gt: 0 },
      expirationDate: { $lt: today },
    }),
    Batch.countDocuments({
      isActive: true,
      quantity: { $gt: 0 },
      expirationDate: { $gte: today, $lte: endOfUtcDay(warningUntil) },
    }),
    Sale.aggregate<{
      count: number
      revenue: number
    }>([
      {
        $match: {
          status: 'COMPLETED',
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]),
    Purchase.aggregate<{
      count: number
      spend: number
    }>([
      {
        $match: {
          status: 'RECEIVED',
          purchaseDate: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          spend: { $sum: '$total' },
        },
      },
    ]),
    SaleItem.aggregate<{
      revenue: number
      cost: number
      profit: number
    }>([
      {
        $lookup: {
          from: 'sales',
          localField: 'sale',
          foreignField: '_id',
          as: 'saleDoc',
        },
      },
      { $unwind: '$saleDoc' },
      {
        $match: {
          'saleDoc.status': 'COMPLETED',
          'saleDoc.createdAt': { $gte: range.from, $lte: range.to },
        },
      },
      {
        $lookup: {
          from: 'batches',
          localField: 'batch',
          foreignField: '_id',
          as: 'batchDoc',
        },
      },
      { $unwind: '$batchDoc' },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalPrice' },
          cost: {
            $sum: { $multiply: ['$quantity', '$batchDoc.purchasePrice'] },
          },
        },
      },
      {
        $project: {
          revenue: 1,
          cost: 1,
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
    ]),
  ])

  return {
    range: {
      from: formatUtcDateKey(range.from),
      to: formatUtcDateKey(range.to),
      timezone: 'UTC',
    },
    inventory: {
      totalMedicines,
      totalStockQuantity: stockAgg[0]?.totalStockQuantity ?? 0,
      lowStockMedicines: lowStockAgg[0]?.count ?? 0,
      expiredBatches,
      expiringSoonBatches,
      expirationWarningDays: warningDays,
    },
    commerce: {
      totalSales: salesStats[0]?.count ?? 0,
      totalPurchases: purchaseStats[0]?.count ?? 0,
      revenue: salesStats[0]?.revenue ?? 0,
      purchaseSpend: purchaseStats[0]?.spend ?? 0,
      profit: profitStats[0]?.profit ?? 0,
      profitNote:
        'Profit = completed sale line totals minus (quantity × batch purchasePrice).',
    },
  }
}

export async function getDashboardCharts(query: DashboardQuery) {
  let range
  try {
    range = resolveDateRange({
      from: query.from,
      to: query.to,
      defaultDays: 30,
    })
  } catch (error: unknown) {
    throw badRequest(error instanceof Error ? error.message : 'Invalid date range')
  }

  const [salesByDay, purchasesByDay] = await Promise.all([
    Sale.aggregate<{ _id: string; total: number; count: number }>([
      {
        $match: {
          status: 'COMPLETED',
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
          },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Purchase.aggregate<{ _id: string; total: number; count: number }>([
      {
        $match: {
          status: 'RECEIVED',
          purchaseDate: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$purchaseDate',
              timezone: 'UTC',
            },
          },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ])

  const salesMap = new Map(salesByDay.map((row) => [row._id, row]))
  const purchasesMap = new Map(purchasesByDay.map((row) => [row._id, row]))

  const series: Array<{
    date: string
    salesTotal: number
    salesCount: number
    purchasesTotal: number
    purchasesCount: number
  }> = []

  const cursor = new Date(range.from)
  const end = startOfUtcDay(range.to)
  while (cursor.getTime() <= end.getTime()) {
    const key = formatUtcDateKey(cursor)
    const sale = salesMap.get(key)
    const purchase = purchasesMap.get(key)
    series.push({
      date: key,
      salesTotal: sale?.total ?? 0,
      salesCount: sale?.count ?? 0,
      purchasesTotal: purchase?.total ?? 0,
      purchasesCount: purchase?.count ?? 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return {
    range: {
      from: formatUtcDateKey(range.from),
      to: formatUtcDateKey(range.to),
      timezone: 'UTC',
    },
    series,
  }
}

export async function getDashboardRecent(limit = 8) {
  const safeLimit = Math.min(Math.max(limit, 1), 20)

  const [recentSales, recentMovements] = await Promise.all([
    Sale.find({ status: 'COMPLETED' })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .select('invoiceNumber total paymentMethod createdAt customerName')
      .populate('soldBy', 'firstName lastName')
      .lean(),
    StockMovement.find({})
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate('medicine', 'name barcode')
      .populate('batch', 'batchNumber')
      .populate('performedBy', 'firstName lastName')
      .lean(),
  ])

  return {
    recentSales,
    recentMovements,
  }
}
