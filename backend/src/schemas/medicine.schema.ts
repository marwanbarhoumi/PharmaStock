import { z } from 'zod'

import { objectIdSchema } from './common.schema.js'
import { paginationQuerySchema } from '../utils/pagination.js'

const medicineSortFields = ['name', 'sellingPrice', 'purchasePrice', 'createdAt'] as const

export const medicineListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  category: objectIdSchema.optional(),
  supplier: objectIdSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
  sort: z.enum(medicineSortFields).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const createMedicineSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  genericName: z.string().trim().max(200).optional().default(''),
  description: z.string().trim().max(1000).optional().default(''),
  category: objectIdSchema,
  laboratory: z.string().trim().max(160).optional().default(''),
  barcode: z.string().trim().min(1).max(80).optional(),
  purchasePrice: z.number().min(0, 'Purchase price must be >= 0'),
  sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
  minimumStock: z.number().int().min(0, 'Minimum stock must be >= 0').default(0),
  unit: z.string().trim().max(40).optional().default('unit'),
  supplier: objectIdSchema.optional().nullable(),
  image: z.string().trim().max(500).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

export const updateMedicineSchema = createMedicineSchema.partial()

export const barcodeParamSchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required').max(80),
})

export type MedicineListQuery = z.infer<typeof medicineListQuerySchema>
export type BarcodeParam = z.infer<typeof barcodeParamSchema>
export type CreateMedicineInput = z.infer<typeof createMedicineSchema>
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>
