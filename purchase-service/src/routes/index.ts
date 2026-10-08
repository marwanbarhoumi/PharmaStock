import { Router } from 'express'

import { healthRouter } from './health.routes.js'
import { purchaseRouter } from './purchase.routes.js'
import { supplierRouter } from './supplier.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/suppliers', supplierRouter)
apiRouter.use('/purchases', purchaseRouter)

export { apiRouter }
