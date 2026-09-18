import { z } from 'zod'

import { SALE_STATUSES } from '../types/enums.js'
import { paginationQuerySchema } from '../utils/pagination.js'
import { objectIdSchema } from './common.schema.js'

export const saleListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(SALE_STATUSES).optional(),
  soldBy: objectIdSchema.optional(),
  sort: z.enum(['createdAt', 'total', 'invoiceNumber']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type SaleListQuery = z.infer<typeof saleListQuerySchema>
