import { z } from 'zod'

import { paginationQuerySchema } from '../utils/pagination.js'

const isoDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const dashboardQuerySchema = z.object({
  from: isoDateString.optional(),
  to: isoDateString.optional(),
})

export const reportDateQuerySchema = paginationQuerySchema.extend({
  from: isoDateString.optional(),
  to: isoDateString.optional(),
  search: z.string().trim().optional(),
})

export const reportExportQuerySchema = z.object({
  type: z.enum([
    'sales',
    'purchases',
    'stock',
    'low-stock',
    'expiration',
    'profit',
  ]),
  format: z.enum(['csv']).default('csv'),
  from: isoDateString.optional(),
  to: isoDateString.optional(),
  search: z.string().trim().optional(),
})

export const expirationReportQuerySchema = reportDateQuerySchema.extend({
  warningDays: z.coerce.number().int().min(1).max(365).optional(),
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type ReportDateQuery = z.infer<typeof reportDateQuerySchema>
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>
export type ExpirationReportQuery = z.infer<typeof expirationReportQuerySchema>
