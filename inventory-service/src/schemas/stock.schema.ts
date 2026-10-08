import { z } from 'zod'

import { objectIdSchema } from './common.schema.js'
import {
  STOCK_MOVEMENT_TYPES,
  STOCK_REFERENCE_TYPES,
} from '../types/enums.js'
import { paginationQuerySchema } from '../utils/pagination.js'

export const stockListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
})

export const stockMovementsQuerySchema = paginationQuerySchema.extend({
  medicine: objectIdSchema.optional(),
  batch: objectIdSchema.optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
  sort: z.enum(['createdAt', 'quantity']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const applyStockMovementSchema = z.object({
  medicineId: objectIdSchema,
  batchId: objectIdSchema,
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reason: z.string().trim().max(500).optional().default(''),
  referenceType: z.enum(STOCK_REFERENCE_TYPES).optional().default('MANUAL'),
  referenceId: objectIdSchema.optional().nullable(),
})

export const fefoAllocateSchema = z.object({
  medicineId: objectIdSchema,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
})

export type StockListQuery = z.infer<typeof stockListQuerySchema>
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>
export type ApplyStockMovementBody = z.infer<typeof applyStockMovementSchema>
export type FefoAllocateBody = z.infer<typeof fefoAllocateSchema>
