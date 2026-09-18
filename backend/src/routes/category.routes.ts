import { Router } from 'express'

import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/category.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  categoryListQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/category.schema.js'

const categoryRouter = Router()

categoryRouter.use(authenticate)

categoryRouter.get(
  '/',
  validateRequest({ query: categoryListQuerySchema }),
  listCategories,
)

categoryRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getCategory,
)

categoryRouter.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: createCategorySchema }),
  createCategory,
)

categoryRouter.put(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema, body: updateCategorySchema }),
  updateCategory,
)

categoryRouter.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  deleteCategory,
)

export { categoryRouter }
