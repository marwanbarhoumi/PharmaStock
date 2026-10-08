import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().trim().email('Email must be a valid email address').toLowerCase(),
  password: passwordSchema,
  phone: z.string().trim().max(40).optional().default(''),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Email must be a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
