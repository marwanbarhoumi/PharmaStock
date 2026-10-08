import type { QueryFilter } from 'mongoose'

import { Supplier, type SupplierDocument } from '../models/index.js'
import type {
  CreateSupplierInput,
  SupplierListQuery,
  UpdateSupplierInput,
} from '../schemas/supplier.schema.js'
import { notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch, omitUndefined } from '../utils/query-builder.js'

const SUPPLIER_SORT_FIELDS = ['name', 'createdAt'] as const

export async function getSuppliers(query: SupplierListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(query.sort, query.order, SUPPLIER_SORT_FIELDS, 'name')

  const filter: QueryFilter<SupplierDocument> = {
    ...buildTextSearch<SupplierDocument>(query.search, [
      'name',
      'email',
      'phone',
      'contactPerson',
    ]),
    isActive: query.isActive ?? true,
  }

  const [items, total] = await Promise.all([
    Supplier.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Supplier.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getSupplierById(id: string) {
  const supplier = await Supplier.findById(id).lean()
  if (!supplier) {
    throw notFound('Supplier')
  }
  return supplier
}

export async function createSupplier(input: CreateSupplierInput) {
  return Supplier.create(input)
}

export async function updateSupplier(id: string, input: UpdateSupplierInput) {
  const supplier = await Supplier.findByIdAndUpdate(
    id,
    { $set: omitUndefined(input) },
    { new: true, runValidators: true },
  ).lean()

  if (!supplier) {
    throw notFound('Supplier')
  }

  return supplier
}

export async function deleteSupplier(id: string) {
  const supplier = await Supplier.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true },
  ).lean()

  if (!supplier) {
    throw notFound('Supplier')
  }

  return supplier
}
