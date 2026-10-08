import { Router } from 'express'

import { dashboardRouter } from './dashboard.routes.js'
import { healthRouter } from './health.routes.js'
import { reportRouter } from './report.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/dashboard', dashboardRouter)
apiRouter.use('/reports', reportRouter)

export { apiRouter }
