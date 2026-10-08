import jwt from 'jsonwebtoken'

import type { UserRole } from '../types/enums.js'
import { unauthorized } from './app-error.js'

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
}

const JWT_ALGORITHM = 'HS256' as const

export function signAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string,
): string {
  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    })

    if (typeof decoded !== 'object' || decoded === null) {
      throw unauthorized('Invalid or expired token')
    }

    const { sub, email, role } = decoded as Record<string, unknown>

    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      typeof role !== 'string'
    ) {
      throw unauthorized('Invalid or expired token')
    }

    return {
      sub,
      email,
      role: role as UserRole,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') {
      throw error
    }
    throw unauthorized('Invalid or expired token')
  }
}
