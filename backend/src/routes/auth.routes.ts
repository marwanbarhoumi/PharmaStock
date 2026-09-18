import { Router } from 'express'

import { login, me, register } from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateRequest } from '../middleware/validate.js'
import { loginSchema, registerSchema } from '../schemas/auth.schema.js'

const authRouter = Router()

authRouter.post(
  '/register',
  validateRequest({ body: registerSchema }),
  register,
)

authRouter.post(
  '/login',
  validateRequest({ body: loginSchema }),
  login,
)

authRouter.get('/me', authenticate, me)

export { authRouter }
