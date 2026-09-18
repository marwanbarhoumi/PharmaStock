import { Router } from 'express'

import { getPurchase, listPurchases } from '../controllers/purchase.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import { purchaseListQuerySchema } from '../schemas/purchase.schema.js'

const purchaseRouter = Router()

purchaseRouter.use(authenticate)

purchaseRouter.get(
  '/',
  validateRequest({ query: purchaseListQuerySchema }),
  listPurchases,
)

purchaseRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getPurchase,
)

export { purchaseRouter }
