import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'

import { login, me, register } from '../controllers/auth.controller.js'
import { loadEnv } from '../config/env.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { loginSchema, registerSchema } from '../schemas/auth.schema.js'

const authRouter = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
})

function publicRegisterOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const env = loadEnv()
  if (env.ALLOW_PUBLIC_REGISTER) {
    next()
    return
  }

  void authenticate(req, res, (authError) => {
    if (authError) {
      next(authError)
      return
    }
    authorize('ADMIN')(req, res, next)
  })
}

authRouter.post(
  '/register',
  authLimiter,
  publicRegisterOrAdmin,
  validateRequest({ body: registerSchema }),
  register,
)

authRouter.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  login,
)

authRouter.get('/me', authenticate, me)

export { authRouter }
