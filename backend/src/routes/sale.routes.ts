import { Router } from 'express'

import { getSale, listSales } from '../controllers/sale.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import { saleListQuerySchema } from '../schemas/sale.schema.js'

const saleRouter = Router()

saleRouter.use(authenticate)

saleRouter.get(
  '/',
  validateRequest({ query: saleListQuerySchema }),
  listSales,
)

saleRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getSale,
)

export { saleRouter }
