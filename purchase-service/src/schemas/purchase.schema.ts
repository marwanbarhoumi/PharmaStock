import { z } from 'zod'

import { PURCHASE_STATUSES } from '../types/enums.js'
import { paginationQuerySchema } from '../utils/pagination.js'
import { objectIdSchema } from './common.schema.js'

export const purchaseListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(PURCHASE_STATUSES).optional(),
  supplier: objectIdSchema.optional(),
  purchasedBy: objectIdSchema.optional(),
  sort: z
    .enum(['purchaseDate', 'createdAt', 'total', 'purchaseNumber'])
    .optional()
    .default('purchaseDate'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const createPurchaseItemSchema = z.object({
  medicineId: objectIdSchema,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().min(0, 'Unit price must be >= 0'),
  batchNumber: z.string().trim().min(1, 'Batch number is required').max(80),
  expirationDate: z.coerce.date(),
})

export const createPurchaseSchema = z.object({
  supplierId: objectIdSchema,
  discount: z.number().min(0, 'Discount must be >= 0').optional().default(0),
  tax: z.number().min(0, 'Tax must be >= 0').optional().default(0),
  /** When true, purchase is created as RECEIVED and stock is increased immediately. */
  receiveNow: z.boolean().optional().default(false),
  items: z
    .array(createPurchaseItemSchema)
    .min(1, 'At least one purchase item is required'),
})

export type PurchaseListQuery = z.infer<typeof purchaseListQuerySchema>
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>
