import type { NextFunction, Request, Response } from 'express'

import { loadEnv } from '../config/env.js'
import { unauthorized } from '../utils/app-error.js'

/**
 * Guards /internal/inventory/* when INTERNAL_API_TOKEN is configured.
 * Internal routes are never proxied by the Gateway.
 */
export function requireInternalToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const expected = loadEnv().INTERNAL_API_TOKEN
  if (!expected) {
    next()
    return
  }

  if (req.headers['x-internal-token'] !== expected) {
    next(unauthorized('Internal authentication required'))
    return
  }

  next()
}
