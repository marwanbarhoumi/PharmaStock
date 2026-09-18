import { z } from 'zod'

import { objectIdSchema } from './common.schema.js'
import { paginationQuerySchema } from '../utils/pagination.js'

const batchSortFields = ['expirationDate', 'batchNumber', 'createdAt', 'quantity'] as const

export const batchListQuerySchema = paginationQuerySchema.extend({
  medicine: objectIdSchema.optional(),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
  sort: z.enum(batchSortFields).optional().default('expirationDate'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const createBatchSchema = z.object({
  medicine: objectIdSchema,
  batchNumber: z.string().trim().min(1, 'Batch number is required').max(80),
  quantity: z.number().min(0, 'Quantity must be >= 0'),
  purchasePrice: z.number().min(0, 'Purchase price must be >= 0'),
  expirationDate: z.coerce.date({
    error: 'Expiration date must be a valid date',
  }),
  receivedDate: z.coerce.date().optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateBatchSchema = createBatchSchema.partial().omit({ medicine: true }).extend({
  medicine: objectIdSchema.optional(),
})

export type BatchListQuery = z.infer<typeof batchListQuerySchema>
export type CreateBatchInput = z.infer<typeof createBatchSchema>
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>
