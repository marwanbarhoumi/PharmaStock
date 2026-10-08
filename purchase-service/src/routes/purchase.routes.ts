import { Router } from 'express'

import {
  cancelPurchase,
  createPurchase,
  getPurchase,
  listPurchases,
  receivePurchase,
} from '../controllers/purchase.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  createPurchaseSchema,
  purchaseListQuerySchema,
} from '../schemas/purchase.schema.js'

const purchaseRouter = Router()

purchaseRouter.use(authenticate)

purchaseRouter.get(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ query: purchaseListQuerySchema }),
  listPurchases,
)

purchaseRouter.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: createPurchaseSchema }),
  createPurchase,
)

purchaseRouter.get(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  getPurchase,
)

purchaseRouter.post(
  '/:id/receive',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  receivePurchase,
)

purchaseRouter.post(
  '/:id/cancel',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  cancelPurchase,
)

export { purchaseRouter }
