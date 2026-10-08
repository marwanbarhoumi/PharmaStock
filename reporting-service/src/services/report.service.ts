import { loadEnv } from '../config/env.js'
import {
  Batch,
  Medicine,
  Purchase,
  Sale,
  SaleItem,
} from '../models/index.js'
import type {
  ExpirationReportQuery,
  ReportDateQuery,
  ReportExportQuery,
} from '../schemas/report.schema.js'
import { badRequest } from '../utils/app-error.js'
import { toCsv } from '../utils/csv.js'
import {
  endOfUtcDay,
  formatUtcDateKey,
  resolveDateRange,
  startOfUtcDay,
} from '../utils/date-range.js'
import {
  buildPaginationMeta,
  getPagination,
} from '../utils/pagination.js'

function resolveRangeOrThrow(query: { from?: string; to?: string }) {
  try {
    return resolveDateRange({
      from: query.from,
      to: query.to,
      defaultDays: 30,
    })
  } catch (error: unknown) {
    throw badRequest(error instanceof Error ? error.message : 'Invalid date range')
  }
}

export async function getSalesReport(query: ReportDateQuery) {
  const range = resolveRangeOrThrow(query)
  const { page, limit, skip } = getPagination(query)

  const filter: Record<string, unknown> = {
    status: 'COMPLETED',
    createdAt: { $gte: range.from, $lte: range.to },
  }

  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.invoiceNumber = new RegExp(escaped, 'i')
  }

  const [items, total, totals] = await Promise.all([
    Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('soldBy', 'firstName lastName email')
      .lean(),
    Sale.countDocuments(filter),
    Sale.aggregate<{ count: number; revenue: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
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
    summary: {
      count: totals[0]?.count ?? 0,
      revenue: totals[0]?.revenue ?? 0,
    },
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getPurchasesReport(query: ReportDateQuery) {
  const range = resolveRangeOrThrow(query)
  const { page, limit, skip } = getPagination(query)

  const filter: Record<string, unknown> = {
    status: 'RECEIVED',
    purchaseDate: { $gte: range.from, $lte: range.to },
  }

  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.purchaseNumber = new RegExp(escaped, 'i')
  }

  const [items, total, totals] = await Promise.all([
    Purchase.find(filter)
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('supplier', 'name')
      .populate('purchasedBy', 'firstName lastName email')
      .lean(),
    Purchase.countDocuments(filter),
    Purchase.aggregate<{ count: number; spend: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          spend: { $sum: '$total' },
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
    summary: {
      count: totals[0]?.count ?? 0,
      spend: totals[0]?.spend ?? 0,
    },
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getStockReport(query: ReportDateQuery) {
  const { page, limit, skip } = getPagination(query)

  const matchMedicine: Record<string, unknown> = { isActive: true }
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    matchMedicine.$or = [{ name: regex }, { barcode: regex }, { genericName: regex }]
  }

  const pipeline = [
    { $match: matchMedicine },
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
              batchCount: { $sum: 1 },
              nearestExpiration: { $min: '$expirationDate' },
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
        batchCount: {
          $ifNull: [{ $arrayElemAt: ['$stock.batchCount', 0] }, 0],
        },
        nearestExpiration: {
          $arrayElemAt: ['$stock.nearestExpiration', 0],
        },
      },
    },
    {
      $addFields: {
        isLowStock: { $lt: ['$totalQuantity', '$minimumStock'] },
      },
    },
    { $sort: { name: 1 as const } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
              barcode: 1,
              unit: 1,
              minimumStock: 1,
              totalQuantity: 1,
              batchCount: 1,
              nearestExpiration: 1,
              isLowStock: 1,
              sellingPrice: 1,
              purchasePrice: 1,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]

  const [result] = await Medicine.aggregate<{
    items: unknown[]
    totalCount: Array<{ count: number }>
  }>(pipeline)

  const total = result?.totalCount[0]?.count ?? 0

  return {
    items: result?.items ?? [],
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getLowStockReport(query: ReportDateQuery) {
  const { page, limit, skip } = getPagination(query)

  const pipeline = [
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
      $addFields: {
        deficit: { $subtract: ['$minimumStock', '$totalQuantity'] },
      },
    },
    { $sort: { deficit: -1 as const, name: 1 as const } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
              barcode: 1,
              unit: 1,
              minimumStock: 1,
              totalQuantity: 1,
              deficit: 1,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]

  const [result] = await Medicine.aggregate<{
    items: unknown[]
    totalCount: Array<{ count: number }>
  }>(pipeline)

  const total = result?.totalCount[0]?.count ?? 0

  return {
    items: result?.items ?? [],
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getExpirationReport(query: ExpirationReportQuery) {
  const { page, limit, skip } = getPagination(query)
  const today = startOfUtcDay(new Date())
  const warningDays = query.warningDays ?? loadEnv().EXPIRATION_WARNING_DAYS
  const warningUntil = new Date(today)
  warningUntil.setUTCDate(warningUntil.getUTCDate() + warningDays)

  const filter: Record<string, unknown> = {
    isActive: true,
    quantity: { $gt: 0 },
    expirationDate: { $lte: endOfUtcDay(warningUntil) },
  }

  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.batchNumber = new RegExp(escaped, 'i')
  }

  const [items, total] = await Promise.all([
    Batch.find(filter)
      .sort({ expirationDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate('medicine', 'name barcode unit')
      .lean(),
    Batch.countDocuments(filter),
  ])

  const mapped = items.map((batch) => {
    const expirationDate = new Date(batch.expirationDate)
    const status = expirationDate < today ? 'EXPIRED' : 'WARNING'
    return {
      ...batch,
      status,
      warningDays,
    }
  })

  return {
    warningDays,
    items: mapped,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getProfitReport(query: ReportDateQuery) {
  const range = resolveRangeOrThrow(query)
  const { page, limit, skip } = getPagination(query)

  const matchStage = {
    'saleDoc.status': 'COMPLETED',
    'saleDoc.createdAt': { $gte: range.from, $lte: range.to },
  }

  const [facet] = await SaleItem.aggregate<{
    summary: Array<{ revenue: number; cost: number; profit: number; lines: number }>
    items: Array<{
      saleId: unknown
      invoiceNumber: string
      medicineName: string
      batchNumber: string
      quantity: number
      unitPrice: number
      totalPrice: number
      purchasePrice: number
      cost: number
      profit: number
      soldAt: Date
    }>
    totalCount: Array<{ count: number }>
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
    { $match: matchStage },
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
      $lookup: {
        from: 'medicines',
        localField: 'medicine',
        foreignField: '_id',
        as: 'medicineDoc',
      },
    },
    { $unwind: '$medicineDoc' },
    {
      $addFields: {
        cost: { $multiply: ['$quantity', '$batchDoc.purchasePrice'] },
        profit: {
          $subtract: [
            '$totalPrice',
            { $multiply: ['$quantity', '$batchDoc.purchasePrice'] },
          ],
        },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalPrice' },
              cost: { $sum: '$cost' },
              profit: { $sum: '$profit' },
              lines: { $sum: 1 },
            },
          },
        ],
        items: [
          { $sort: { 'saleDoc.createdAt': -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              saleId: '$saleDoc._id',
              invoiceNumber: '$saleDoc.invoiceNumber',
              medicineName: '$medicineDoc.name',
              batchNumber: '$batchDoc.batchNumber',
              quantity: 1,
              unitPrice: 1,
              totalPrice: 1,
              purchasePrice: '$batchDoc.purchasePrice',
              cost: 1,
              profit: 1,
              soldAt: '$saleDoc.createdAt',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ])

  const summary = facet?.summary[0] ?? {
    revenue: 0,
    cost: 0,
    profit: 0,
    lines: 0,
  }
  const total = facet?.totalCount[0]?.count ?? 0

  return {
    range: {
      from: formatUtcDateKey(range.from),
      to: formatUtcDateKey(range.to),
      timezone: 'UTC',
    },
    summary,
    note: 'Profit uses batch.purchasePrice at reporting time for each sold line.',
    items: facet?.items ?? [],
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function buildReportCsv(query: ReportExportQuery): Promise<{
  filename: string
  content: string
}> {
  const stamp = formatUtcDateKey(new Date())

  switch (query.type) {
    case 'sales': {
      const range = resolveRangeOrThrow(query)
      const items = await Sale.find({
        status: 'COMPLETED',
        createdAt: { $gte: range.from, $lte: range.to },
      })
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean()

      return {
        filename: `sales-report-${stamp}.csv`,
        content: toCsv(
          ['invoiceNumber', 'total', 'discount', 'tax', 'paymentMethod', 'createdAt'],
          items.map((item) => [
            item.invoiceNumber,
            item.total,
            item.discount,
            item.tax,
            item.paymentMethod,
            item.createdAt?.toISOString() ?? '',
          ]),
        ),
      }
    }
    case 'purchases': {
      const range = resolveRangeOrThrow(query)
      const items = await Purchase.find({
        status: 'RECEIVED',
        purchaseDate: { $gte: range.from, $lte: range.to },
      })
        .sort({ purchaseDate: -1 })
        .limit(5000)
        .lean()

      return {
        filename: `purchases-report-${stamp}.csv`,
        content: toCsv(
          ['purchaseNumber', 'total', 'discount', 'tax', 'purchaseDate'],
          items.map((item) => [
            item.purchaseNumber,
            item.total,
            item.discount,
            item.tax,
            item.purchaseDate?.toISOString() ?? '',
          ]),
        ),
      }
    }
    case 'stock': {
      const report = await getStockReport({
        search: query.search,
        page: 1,
        limit: 5000,
      })
      return {
        filename: `stock-report-${stamp}.csv`,
        content: toCsv(
          [
            'name',
            'barcode',
            'totalQuantity',
            'minimumStock',
            'isLowStock',
            'batchCount',
            'nearestExpiration',
          ],
          (report.items as Array<Record<string, unknown>>).map((item) => [
            String(item.name ?? ''),
            String(item.barcode ?? ''),
            Number(item.totalQuantity ?? 0),
            Number(item.minimumStock ?? 0),
            item.isLowStock ? 'yes' : 'no',
            Number(item.batchCount ?? 0),
            item.nearestExpiration
              ? new Date(String(item.nearestExpiration)).toISOString()
              : '',
          ]),
        ),
      }
    }
    case 'low-stock': {
      const report = await getLowStockReport({ page: 1, limit: 5000 })
      return {
        filename: `low-stock-report-${stamp}.csv`,
        content: toCsv(
          ['name', 'barcode', 'totalQuantity', 'minimumStock', 'deficit', 'unit'],
          (report.items as Array<Record<string, unknown>>).map((item) => [
            String(item.name ?? ''),
            String(item.barcode ?? ''),
            Number(item.totalQuantity ?? 0),
            Number(item.minimumStock ?? 0),
            Number(item.deficit ?? 0),
            String(item.unit ?? ''),
          ]),
        ),
      }
    }
    case 'expiration': {
      const report = await getExpirationReport({
        search: query.search,
        page: 1,
        limit: 5000,
      })
      return {
        filename: `expiration-report-${stamp}.csv`,
        content: toCsv(
          ['batchNumber', 'medicine', 'quantity', 'expirationDate', 'status'],
          (
            report.items as Array<{
              batchNumber: string
              medicine?: { name?: string } | string
              quantity: number
              expirationDate: Date
              status: string
            }>
          ).map((item) => [
            item.batchNumber,
            typeof item.medicine === 'object'
              ? (item.medicine?.name ?? '')
              : String(item.medicine ?? ''),
            item.quantity,
            new Date(item.expirationDate).toISOString().slice(0, 10),
            item.status,
          ]),
        ),
      }
    }
    case 'profit': {
      const report = await getProfitReport({
        from: query.from,
        to: query.to,
        page: 1,
        limit: 5000,
      })
      return {
        filename: `profit-report-${stamp}.csv`,
        content: toCsv(
          [
            'invoiceNumber',
            'medicineName',
            'batchNumber',
            'quantity',
            'revenue',
            'cost',
            'profit',
            'soldAt',
          ],
          report.items.map((item) => [
            item.invoiceNumber,
            item.medicineName,
            item.batchNumber,
            item.quantity,
            item.totalPrice,
            item.cost,
            item.profit,
            new Date(item.soldAt).toISOString(),
          ]),
        ),
      }
    }
    default:
      throw badRequest('Unsupported report type')
  }
}
