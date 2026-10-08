import type { Request, Response } from 'express'

import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js'
import { recordAuditLog } from '../services/audit-log.service.js'
import * as authService from '../services/auth.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'
import { unauthorized } from '../utils/app-error.js'

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body as RegisterInput)
  void recordAuditLog({
    userId: result.user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: result.user.id,
    description: 'User registered and authenticated',
    ipAddress: req.ip,
  })
  sendCreated(res, 'Registration successful', result)
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body as LoginInput)
  void recordAuditLog({
    userId: result.user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: result.user.id,
    description: 'User logged in',
    ipAddress: req.ip,
  })
  sendSuccess({
    res,
    message: 'Login successful',
    data: result,
  })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw unauthorized()
  }

  const user = await authService.getCurrentUser(req.user.id)
  sendSuccess({
    res,
    message: 'Current user retrieved successfully',
    data: user,
  })
})
