import { z } from 'zod'

import { PAYMENT_METHODS, SALE_STATUSES } from '../types/enums.js'
import { paginationQuerySchema } from '../utils/pagination.js'
import { objectIdSchema } from './common.schema.js'

export const saleListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(SALE_STATUSES).optional(),
  soldBy: objectIdSchema.optional(),
  sort: z.enum(['createdAt', 'total', 'invoiceNumber']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const createSaleItemSchema = z.object({
  medicineId: objectIdSchema,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
})

export const createSaleSchema = z.object({
  customerName: z.string().trim().max(160).optional().default(''),
  customerPhone: z.string().trim().max(40).optional().default(''),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default('CASH'),
  discount: z.number().min(0, 'Discount must be >= 0').optional().default(0),
  tax: z.number().min(0, 'Tax must be >= 0').optional().default(0),
  items: z.array(createSaleItemSchema).min(1, 'At least one sale item is required'),
})

export type SaleListQuery = z.infer<typeof saleListQuerySchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
