import { Router } from 'express'

import { introspect } from '../controllers/introspect.controller.js'

const internalAuthRouter = Router()

internalAuthRouter.post('/introspect', introspect)

export { internalAuthRouter }
