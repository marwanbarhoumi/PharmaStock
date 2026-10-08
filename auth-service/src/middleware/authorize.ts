import type { NextFunction, Request, Response } from 'express'

import type { UserRole } from '../types/enums.js'
import { forbidden, unauthorized } from '../utils/app-error.js'

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized())
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(forbidden())
      return
    }

    next()
  }
}
