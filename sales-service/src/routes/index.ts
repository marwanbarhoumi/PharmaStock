import { Router } from 'express'

import { healthRouter } from './health.routes.js'
import { saleRouter } from './sale.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/sales', saleRouter)

export { apiRouter }
