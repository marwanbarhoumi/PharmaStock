import { z } from 'zod'

import { AUDIT_ACTIONS } from '../types/enums.js'
import { paginationQuerySchema } from '../utils/pagination.js'
import { objectIdSchema } from './common.schema.js'

export const auditLogListQuerySchema = paginationQuerySchema.extend({
  user: objectIdSchema.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entity: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>
