import type { UserRole } from '../types/enums.js'

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export {}
