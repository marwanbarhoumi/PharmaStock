import type { QueryFilter } from 'mongoose'

import { Category, type CategoryDocument } from '../models/index.js'
import type {
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/category.schema.js'
import { conflict, notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { buildTextSearch, omitUndefined } from '../utils/query-builder.js'

const CATEGORY_SORT_FIELDS = ['name', 'createdAt'] as const

export async function getCategories(query: CategoryListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(query.sort, query.order, CATEGORY_SORT_FIELDS, 'name')

  const filter: QueryFilter<CategoryDocument> = {
    ...buildTextSearch<CategoryDocument>(query.search, ['name', 'description']),
    isActive: query.isActive ?? true,
  }

  const [items, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getCategoryById(id: string) {
  const category = await Category.findById(id).lean()
  if (!category) {
    throw notFound('Category')
  }
  return category
}

export async function createCategory(input: CreateCategoryInput) {
  const existing = await Category.findOne({ name: input.name }).select('_id')
  if (existing) {
    throw conflict('A category with this name already exists')
  }

  return Category.create(input)
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  if (input.name) {
    const duplicate = await Category.findOne({ name: input.name }).select('_id')
    if (duplicate && String(duplicate._id) !== id) {
      throw conflict('A category with this name already exists')
    }
  }

  const category = await Category.findByIdAndUpdate(
    id,
    { $set: omitUndefined(input) },
    { new: true, runValidators: true },
  ).lean()

  if (!category) {
    throw notFound('Category')
  }

  return category
}

export async function deleteCategory(id: string) {
  const category = await Category.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true },
  ).lean()

  if (!category) {
    throw notFound('Category')
  }

  return category
}
