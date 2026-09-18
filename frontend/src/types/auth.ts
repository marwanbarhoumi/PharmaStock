export type UserRole = 'ADMIN' | 'PHARMACIST' | 'EMPLOYEE'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  phone: string
  isActive: boolean
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: string
}

export type ApiSuccess<T> = {
  success: true
  message?: string
  data: T
}

export type ApiErrorBody = {
  success: false
  message: string
  errors?: Array<{ path?: string; message: string }>
}
