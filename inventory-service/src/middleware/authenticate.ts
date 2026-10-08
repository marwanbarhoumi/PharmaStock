import type { NextFunction, Request, Response } from 'express'

import { loadEnv } from '../config/env.js'
import { User } from '../models/index.js'
import type { UserRole } from '../types/enums.js'
import { unauthorized } from '../utils/app-error.js'
import { verifyAccessToken } from '../utils/jwt.js'

interface IntrospectResponse {
  success?: boolean
  data?: {
    active?: boolean
    user?: {
      id: string
      email: string
      role: UserRole
      isActive?: boolean
    }
    claims?: {
      sub: string
      email: string
      role: UserRole
    }
  }
}

async function introspectToken(
  authServiceUrl: string,
  token: string,
): Promise<{ id: string; email: string; role: UserRole }> {
  const response = await fetch(`${authServiceUrl}/internal/auth/introspect`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (response.status === 401 || response.status === 403 || !response.ok) {
    throw unauthorized('Authentication required')
  }

  const body = (await response.json()) as IntrospectResponse
  const user = body.data?.user
  const claims = body.data?.claims

  if (!body.data?.active || !user?.id || !user.email || !user.role) {
    throw unauthorized('Authentication required')
  }

  if (user.isActive === false) {
    throw unauthorized('Authentication required')
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role ?? claims?.role,
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization

    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized('Authentication required')
    }

    const token = header.slice('Bearer '.length).trim()
    if (!token) {
      throw unauthorized('Authentication required')
    }

    const env = loadEnv()

    if (env.AUTH_SERVICE_URL) {
      req.user = await introspectToken(env.AUTH_SERVICE_URL, token)
      next()
      return
    }

    const payload = verifyAccessToken(token, env.JWT_SECRET)
    const user = await User.findById(payload.sub).select('_id email role isActive')
    if (!user || user.isActive === false) {
      throw unauthorized('Authentication required')
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }

    next()
  } catch (error) {
    next(error)
  }
}
