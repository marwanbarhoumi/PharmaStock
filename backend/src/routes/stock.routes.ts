import { Router } from 'express'

import {
  allocateFefo,
  createStockMovement,
  getStockByMedicine,
  listStock,
  listStockMovements,
} from '../controllers/stock.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { medicineIdParamSchema } from '../schemas/common.schema.js'
import {
  applyStockMovementSchema,
  fefoAllocateSchema,
  stockListQuerySchema,
  stockMovementsQuerySchema,
} from '../schemas/stock.schema.js'

const stockRouter = Router()

stockRouter.use(authenticate)

stockRouter.get(
  '/',
  validateRequest({ query: stockListQuerySchema }),
  listStock,
)

stockRouter.get(
  '/movements',
  validateRequest({ query: stockMovementsQuerySchema }),
  listStockMovements,
)

stockRouter.post(
  '/movements',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: applyStockMovementSchema }),
  createStockMovement,
)

stockRouter.post(
  '/fefo/allocate',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: fefoAllocateSchema }),
  allocateFefo,
)

stockRouter.get(
  '/:medicineId',
  validateRequest({ params: medicineIdParamSchema }),
  getStockByMedicine,
)

export { stockRouter }
