import { Router } from 'express'

import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../controllers/supplier.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  createSupplierSchema,
  supplierListQuerySchema,
  updateSupplierSchema,
} from '../schemas/supplier.schema.js'

const supplierRouter = Router()

supplierRouter.use(authenticate)

supplierRouter.get(
  '/',
  validateRequest({ query: supplierListQuerySchema }),
  listSuppliers,
)

supplierRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getSupplier,
)

supplierRouter.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: createSupplierSchema }),
  createSupplier,
)

supplierRouter.put(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema, body: updateSupplierSchema }),
  updateSupplier,
)

supplierRouter.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  deleteSupplier,
)

export { supplierRouter }
