import type { QueryFilter } from 'mongoose'

import { Batch, type BatchDocument } from '../models/index.js'
import type {
  BatchListQuery,
  CreateBatchInput,
  UpdateBatchInput,
} from '../schemas/batch.schema.js'
import { conflict, notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch, omitUndefined } from '../utils/query-builder.js'
import { assertMedicineActive as assertMedicineExists } from './catalog-client.js'

const BATCH_SORT_FIELDS = [
  'expirationDate',
  'batchNumber',
  'createdAt',
  'quantity',
] as const

export async function getBatches(query: BatchListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(
    query.sort,
    query.order,
    BATCH_SORT_FIELDS,
    'expirationDate',
  )

  const filter: QueryFilter<BatchDocument> = {
    ...buildTextSearch<BatchDocument>(query.search, ['batchNumber']),
    isActive: query.isActive ?? true,
  }

  if (query.medicine) {
    filter.medicine = query.medicine
  }

  const [items, total] = await Promise.all([
    Batch.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('medicine', 'name barcode unit')
      .lean(),
    Batch.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getBatchById(id: string) {
  const batch = await Batch.findById(id)
    .populate('medicine', 'name barcode unit category supplier')
    .lean()

  if (!batch) {
    throw notFound('Batch')
  }

  return batch
}

export async function createBatch(input: CreateBatchInput) {
  await assertMedicineExists(input.medicine)

  const duplicate = await Batch.findOne({
    medicine: input.medicine,
    batchNumber: input.batchNumber,
  }).select('_id')

  if (duplicate) {
    throw conflict('This batch number already exists for the medicine')
  }

  const batch = await Batch.create(input)

  return Batch.findById(batch._id)
    .populate('medicine', 'name barcode unit')
    .lean()
}

export async function updateBatch(id: string, input: UpdateBatchInput) {
  const existing = await Batch.findById(id)
  if (!existing) {
    throw notFound('Batch')
  }

  if (input.medicine) {
    await assertMedicineExists(input.medicine)
  }

  const medicineId = input.medicine ?? String(existing.medicine)
  const batchNumber = input.batchNumber ?? existing.batchNumber

  if (input.medicine || input.batchNumber) {
    const duplicate = await Batch.findOne({
      medicine: medicineId,
      batchNumber,
    }).select('_id')

    if (duplicate && String(duplicate._id) !== id) {
      throw conflict('This batch number already exists for the medicine')
    }
  }

  const batch = await Batch.findByIdAndUpdate(
    id,
    { $set: omitUndefined(input) },
    { new: true, runValidators: true },
  )
    .populate('medicine', 'name barcode unit')
    .lean()

  return batch
}

export async function deleteBatch(id: string) {
  const batch = await Batch.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true },
  )
    .populate('medicine', 'name barcode unit')
    .lean()

  if (!batch) {
    throw notFound('Batch')
  }

  return batch
}
