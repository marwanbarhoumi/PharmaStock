import type { QueryFilter } from 'mongoose'

import { Purchase, type PurchaseDocument } from '../models/index.js'
import type { PurchaseListQuery } from '../schemas/purchase.schema.js'
import { notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch } from '../utils/query-builder.js'

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
      .populate({
        path: 'items',
        populate: [
          { path: 'medicine', select: 'name barcode' },
          { path: 'batch', select: 'batchNumber expirationDate' },
        ],
      })
      .lean(),
    Purchase.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getPurchaseById(id: string) {
  const purchase = await Purchase.findById(id)
    .populate('supplier', 'name phone email address contactPerson')
    .populate('purchasedBy', 'firstName lastName email role')
    .populate({
      path: 'items',
      populate: [
        { path: 'medicine', select: 'name barcode unit' },
        { path: 'batch', select: 'batchNumber expirationDate quantity' },
      ],
    })
    .lean()

  if (!purchase) {
    throw notFound('Purchase')
  }

  return purchase
}
