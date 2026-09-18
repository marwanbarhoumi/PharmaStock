import type { UserRole } from '../types/enums.js'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  phone: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export function toSafeUser(user: {
  _id: { toString(): string }
  firstName: string
  lastName: string
  email: string
  role: string
  phone?: string | null
  isActive?: boolean | null
  createdAt?: Date
  updatedAt?: Date
}): AuthUser {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role as UserRole,
    phone: user.phone ?? '',
    isActive: user.isActive ?? true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
