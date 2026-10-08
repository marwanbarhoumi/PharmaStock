import type { QueryFilter } from 'mongoose'

import {
  Batch,
  Category,
  Medicine,
  Supplier,
  type MedicineDocument,
} from '../models/index.js'
import type {
  CreateMedicineInput,
  MedicineListQuery,
  UpdateMedicineInput,
} from '../schemas/medicine.schema.js'
import { conflict, notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch, omitUndefined } from '../utils/query-builder.js'

const MEDICINE_SORT_FIELDS = [
  'name',
  'sellingPrice',
  'purchasePrice',
  'createdAt',
] as const

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await Category.findById(categoryId).select('_id isActive')
  if (!category || category.isActive === false) {
    throw notFound('Category')
  }
}

async function assertSupplierExists(supplierId: string | null | undefined): Promise<void> {
  if (!supplierId) {
    return
  }

  const supplier = await Supplier.findById(supplierId).select('_id isActive')
  if (!supplier || supplier.isActive === false) {
    throw notFound('Supplier')
  }
}

export async function getMedicines(query: MedicineListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(query.sort, query.order, MEDICINE_SORT_FIELDS, 'name')

  const filter: QueryFilter<MedicineDocument> = {
    ...buildTextSearch<MedicineDocument>(query.search, [
      'name',
      'genericName',
      'barcode',
      'laboratory',
    ]),
  }

  if (query.category) {
    filter.category = query.category
  }

  if (query.supplier) {
    filter.supplier = query.supplier
  }

  filter.isActive = query.isActive ?? true

  const [items, total] = await Promise.all([
    Medicine.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name')
      .populate('supplier', 'name phone email')
      .lean(),
    Medicine.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getMedicineById(id: string) {
  const medicine = await Medicine.findById(id)
    .populate('category', 'name description isActive')
    .populate('supplier', 'name phone email address contactPerson isActive')
    .lean()

  if (!medicine) {
    throw notFound('Medicine')
  }

  const batches = await Batch.find({ medicine: id, isActive: true })
    .sort({ expirationDate: 1 })
    .lean()

  return { ...medicine, batches }
}

export async function getMedicineByBarcode(barcode: string) {
  const normalized = barcode.trim()
  if (!normalized) {
    throw notFound('Medicine')
  }

  const medicine = await Medicine.findOne({ barcode: normalized })
    .populate('category', 'name')
    .populate('supplier', 'name phone email')
    .lean()

  if (!medicine) {
    throw notFound('Medicine')
  }

  const batches = await Batch.find({ isActive: true })
    .where('medicine')
    .equals(medicine._id)
    .sort({ expirationDate: 1 })
    .lean()

  const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0)

  return {
    ...medicine,
    totalQuantity,
    batches,
  }
}

export async function createMedicine(input: CreateMedicineInput) {
  await assertCategoryExists(input.category)
  await assertSupplierExists(input.supplier)

  if (input.barcode) {
    const existing = await Medicine.findOne({ barcode: input.barcode }).select('_id')
    if (existing) {
      throw conflict('A medicine with this barcode already exists')
    }
  }

  const medicine = await Medicine.create(input)

  return Medicine.findById(medicine._id)
    .populate('category', 'name')
    .populate('supplier', 'name phone email')
    .lean()
}

export async function updateMedicine(id: string, input: UpdateMedicineInput) {
  const existing = await Medicine.findById(id)
  if (!existing) {
    throw notFound('Medicine')
  }

  if (input.category) {
    await assertCategoryExists(input.category)
  }

  if (input.supplier !== undefined) {
    await assertSupplierExists(input.supplier)
  }

  if (input.barcode) {
    const duplicate = await Medicine.findOne({ barcode: input.barcode }).select('_id')
    if (duplicate && String(duplicate._id) !== id) {
      throw conflict('A medicine with this barcode already exists')
    }
  }

  const medicine = await Medicine.findByIdAndUpdate(
    id,
    { $set: omitUndefined(input) },
    { new: true, runValidators: true },
  )
    .populate('category', 'name')
    .populate('supplier', 'name phone email')
    .lean()

  return medicine
}

export async function deleteMedicine(id: string) {
  const medicine = await Medicine.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true },
  )
    .populate('category', 'name')
    .populate('supplier', 'name phone email')
    .lean()

  if (!medicine) {
    throw notFound('Medicine')
  }

  return medicine
}
