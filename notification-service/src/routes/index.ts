import { Router } from 'express'

import { alertCheckRouter } from './alert-check.routes.js'
import { healthRouter } from './health.routes.js'
import { notificationRouter } from './notification.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/notifications', notificationRouter)
apiRouter.use('/alerts', alertCheckRouter)

export { apiRouter }
