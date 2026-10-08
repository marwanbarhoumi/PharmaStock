import { Router } from 'express'

import {
  cancelSale,
  createSale,
  getSale,
  listSales,
} from '../controllers/sale.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  createSaleSchema,
  saleListQuerySchema,
} from '../schemas/sale.schema.js'

const saleRouter = Router()

saleRouter.use(authenticate)

saleRouter.get(
  '/',
  validateRequest({ query: saleListQuerySchema }),
  listSales,
)

saleRouter.post(
  '/',
  authorize('ADMIN', 'PHARMACIST', 'EMPLOYEE'),
  validateRequest({ body: createSaleSchema }),
  createSale,
)

saleRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getSale,
)

saleRouter.post(
  '/:id/cancel',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  cancelSale,
)

export { saleRouter }
