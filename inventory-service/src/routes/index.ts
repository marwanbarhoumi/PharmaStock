import { Router } from 'express'

import { alertRouter } from './alert.routes.js'
import { batchRouter } from './batch.routes.js'
import { healthRouter } from './health.routes.js'
import { internalInventoryRouter } from './internal-inventory.routes.js'
import { stockRouter } from './stock.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/batches', batchRouter)
apiRouter.use('/stock', stockRouter)
apiRouter.use('/alerts', alertRouter)

export { apiRouter, internalInventoryRouter }
