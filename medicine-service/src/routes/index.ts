import { Router } from 'express'

import { categoryRouter } from './category.routes.js'
import { healthRouter } from './health.routes.js'
import { medicineRouter } from './medicine.routes.js'
import { internalCatalogRouter } from './internal-catalog.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/medicines', medicineRouter)
apiRouter.use('/categories', categoryRouter)

export { apiRouter, internalCatalogRouter }
