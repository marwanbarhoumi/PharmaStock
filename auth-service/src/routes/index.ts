import { Router } from 'express'

import { auditLogRouter } from './audit-log.routes.js'
import { authRouter } from './auth.routes.js'
import { healthRouter } from './health.routes.js'
import { internalAuthRouter } from './internal-auth.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/audit-logs', auditLogRouter)

export { apiRouter, internalAuthRouter }
