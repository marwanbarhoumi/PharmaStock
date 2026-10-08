import { z } from 'zod'

import { objectIdSchema } from './common.schema.js'
import {
  STOCK_MOVEMENT_TYPES,
  STOCK_REFERENCE_TYPES,
} from '../types/enums.js'

export const internalMovementSchema = z.object({
  medicineId: objectIdSchema,
  batchId: objectIdSchema,
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reason: z.string().trim().max(500).optional().default(''),
  referenceType: z.enum(STOCK_REFERENCE_TYPES).optional().default('MANUAL'),
  referenceId: objectIdSchema.optional().nullable(),
  performedBy: objectIdSchema,
})

export const internalFefoSchema = z.object({
  medicineId: objectIdSchema,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
})

export const internalCreateBatchSchema = z.object({
  medicineId: objectIdSchema,
  batchNumber: z.string().trim().min(1, 'Batch number is required').max(80),
  purchasePrice: z.number().min(0, 'Purchase price must be >= 0'),
  expirationDate: z.coerce.date({
    error: 'Expiration date must be a valid date',
  }),
})

export const internalAlertsQuerySchema = z.object({
  warningDays: z.coerce.number().int().min(1).max(365).optional(),
})

export const internalReferencesSchema = z.object({
  medicineIds: z.array(objectIdSchema).max(500).optional().default([]),
  batchIds: z.array(objectIdSchema).max(500).optional().default([]),
  /** Adds batch purchasePrice (purchase detail view). Default keeps the original fields. */
  includePurchasePrice: z.boolean().optional().default(false),
})

export type InternalAlertsQuery = z.infer<typeof internalAlertsQuerySchema>
export type InternalReferencesBody = z.infer<typeof internalReferencesSchema>
export type InternalMovementBody = z.infer<typeof internalMovementSchema>
export type InternalFefoBody = z.infer<typeof internalFefoSchema>
export type InternalCreateBatchBody = z.infer<typeof internalCreateBatchSchema>
