import type { QueryFilter, PipelineStage } from 'mongoose'

import {
  Batch,
  Medicine,
  StockMovement,
  type StockMovementDocument,
} from '../models/index.js'
import type {
  StockListQuery,
  StockMovementsQuery,
} from '../schemas/stock.schema.js'
import { notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'

const MOVEMENT_SORT_FIELDS = ['createdAt', 'quantity'] as const

export async function getStockOverview(query: StockListQuery) {
  const { page, limit, skip } = getPagination(query)

  const matchMedicine: Record<string, unknown> = { isActive: true }

  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    matchMedicine.$or = [
      { name: regex },
      { genericName: regex },
      { barcode: regex },
    ]
  }

  const pipeline: PipelineStage[] = [
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
  ]

  if (query.lowStock === true) {
    pipeline.push({ $match: { isLowStock: true } })
  }

  pipeline.push(
    {
      $project: {
        name: 1,
        genericName: 1,
        barcode: 1,
        unit: 1,
        minimumStock: 1,
        totalQuantity: 1,
        batchCount: 1,
        nearestExpiration: 1,
        isLowStock: 1,
        category: 1,
        supplier: 1,
      },
    },
    { $sort: { name: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    },
  )

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

export async function getStockByMedicineId(medicineId: string) {
  const medicine = await Medicine.findById(medicineId)
    .select('name genericName barcode unit minimumStock isActive')
    .lean()

  if (!medicine || medicine.isActive === false) {
    throw notFound('Medicine')
  }

  const batches = await Batch.find({ medicine: medicineId, isActive: true })
    .sort({ expirationDate: 1 })
    .lean()

  const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0)

  return {
    medicine,
    totalQuantity,
    isLowStock: totalQuantity < medicine.minimumStock,
    batches,
  }
}

export async function getStockMovements(query: StockMovementsQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(
    query.sort,
    query.order,
    MOVEMENT_SORT_FIELDS,
    'createdAt',
  )

  const filter: QueryFilter<StockMovementDocument> = {}

  if (query.medicine) {
    filter.medicine = query.medicine
  }
  if (query.batch) {
    filter.batch = query.batch
  }
  if (query.type) {
    filter.type = query.type
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('medicine', 'name barcode')
      .populate('batch', 'batchNumber expirationDate')
      .populate('performedBy', 'firstName lastName email')
      .lean(),
    StockMovement.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}
