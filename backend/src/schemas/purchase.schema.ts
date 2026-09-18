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

export type PurchaseListQuery = z.infer<typeof purchaseListQuerySchema>
