import { z } from 'zod'

import { paginationQuerySchema } from '../utils/pagination.js'

const categorySortFields = ['name', 'createdAt'] as const

export const categoryListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
  sort: z.enum(categorySortFields).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

export const updateCategorySchema = createCategorySchema.partial()

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
