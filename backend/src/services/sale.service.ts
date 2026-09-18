import type { QueryFilter } from 'mongoose'

import { Sale, type SaleDocument } from '../models/index.js'
import type { SaleListQuery } from '../schemas/sale.schema.js'
import { notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch } from '../utils/query-builder.js'

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
      .populate({
        path: 'items',
        populate: [
          { path: 'medicine', select: 'name barcode' },
          { path: 'batch', select: 'batchNumber expirationDate' },
        ],
      })
      .lean(),
    Sale.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getSaleById(id: string) {
  const sale = await Sale.findById(id)
    .populate('soldBy', 'firstName lastName email role')
    .populate({
      path: 'items',
      populate: [
        { path: 'medicine', select: 'name barcode unit' },
        { path: 'batch', select: 'batchNumber expirationDate quantity' },
      ],
    })
    .lean()

  if (!sale) {
    throw notFound('Sale')
  }

  return sale
}
