import { z } from 'zod'

import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITIES } from '../types/enums.js'
import { paginationQuerySchema } from '../utils/pagination.js'

export const notificationListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  severity: z.enum(NOTIFICATION_SEVERITIES).optional(),
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
  sort: z.enum(['createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>
