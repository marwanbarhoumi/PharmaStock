import { z } from 'zod'

import { isValidObjectId } from '../utils/object-id.js'

export const objectIdSchema = z
  .string()
  .refine(isValidObjectId, { message: 'Invalid MongoDB ObjectId' })

export const idParamSchema = z.object({
  id: objectIdSchema,
})

export const medicineIdParamSchema = z.object({
  medicineId: objectIdSchema,
})
