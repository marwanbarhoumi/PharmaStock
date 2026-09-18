import type { NextFunction, Request, Response } from 'express'

import { loadEnv } from '../config/env.js'
import { User } from '../models/index.js'
import { unauthorized } from '../utils/app-error.js'
import { verifyAccessToken } from '../utils/jwt.js'

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
