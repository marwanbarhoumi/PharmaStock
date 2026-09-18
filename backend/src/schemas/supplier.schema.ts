import { z } from 'zod'

import { paginationQuerySchema } from '../utils/pagination.js'

const supplierSortFields = ['name', 'createdAt'] as const

export const supplierListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
  sort: z.enum(supplierSortFields).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  phone: z.string().trim().max(40).optional().default(''),
  email: z
    .string()
    .trim()
    .email('Email must be a valid email address')
    .optional()
    .or(z.literal(''))
    .transform((value) => (value === '' ? undefined : value)),
  address: z.string().trim().max(300).optional().default(''),
  contactPerson: z.string().trim().max(120).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

export const updateSupplierSchema = createSupplierSchema.partial()

export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
