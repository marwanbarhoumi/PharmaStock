import { Router } from 'express'

import {
  createBatch,
  deleteBatch,
  getBatch,
  listBatches,
  updateBatch,
} from '../controllers/batch.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  batchListQuerySchema,
  createBatchSchema,
  updateBatchSchema,
} from '../schemas/batch.schema.js'

const batchRouter = Router()

batchRouter.use(authenticate)

batchRouter.get(
  '/',
  validateRequest({ query: batchListQuerySchema }),
  listBatches,
)

batchRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getBatch,
)

batchRouter.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: createBatchSchema }),
  createBatch,
)

batchRouter.put(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema, body: updateBatchSchema }),
  updateBatch,
)

batchRouter.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  deleteBatch,
)

export { batchRouter }
