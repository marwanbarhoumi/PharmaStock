import type { Request, Response } from 'express'

import { loadEnv } from '../config/env.js'
import { User } from '../models/index.js'
import { asyncHandler } from '../utils/async-handler.js'
import { unauthorized } from '../utils/app-error.js'
import { sendSuccess } from '../utils/api-response.js'
import { verifyAccessToken } from '../utils/jwt.js'
import { toSafeUser } from '../utils/user-mapper.js'

/**
 * Internal introspection for the other services.
 * Validates JWT, loads user, and enforces isActive — same rules as authenticate.
 *
 * POST /internal/auth/introspect
 * Authorization: Bearer <token>
 * or body: { "token": "..." }
 */
export const introspect = asyncHandler(async (req: Request, res: Response) => {
  const header = req.headers.authorization
  const bodyToken =
    typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  const headerToken =
    header && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : ''
  const token = headerToken || bodyToken

  if (!token) {
    throw unauthorized('Authentication required')
  }

  const env = loadEnv()
  const payload = verifyAccessToken(token, env.JWT_SECRET)

  const user = await User.findById(payload.sub).select(
    '_id firstName lastName email role phone isActive createdAt updatedAt',
  )
  if (!user || user.isActive === false) {
    throw unauthorized('Authentication required')
  }

  const safe = toSafeUser(user)
  sendSuccess({
    res,
    message: 'Token introspected successfully',
    data: {
      active: true,
      user: safe,
      claims: {
        sub: safe.id,
        email: safe.email,
        role: safe.role,
      },
    },
  })
})
