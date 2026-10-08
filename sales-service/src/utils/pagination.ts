import { z } from 'zod'

import { badRequest } from './app-error.js'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export function getPagination(query: PaginationQuery): {
  page: number
  limit: number
  skip: number
} {
  const page = query.page
  const limit = query.limit
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  }
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

export function parseSort(
  sort: string | undefined,
  order: string | undefined,
  allowedFields: readonly string[],
  defaultField: string,
): Record<string, 1 | -1> {
  const field = sort && allowedFields.includes(sort) ? sort : defaultField

  if (sort && !allowedFields.includes(sort)) {
    throw badRequest(
      `Invalid sort field. Allowed: ${allowedFields.join(', ')}`,
    )
  }

  const direction = order === 'desc' ? -1 : 1
  return { [field]: direction }
}
