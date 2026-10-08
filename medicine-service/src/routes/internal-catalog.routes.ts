import { Router } from 'express'

import { getCategory } from '../controllers/category.controller.js'
import {
  getMedicine,
  getMedicineByBarcode,
} from '../controllers/medicine.controller.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import { barcodeParamSchema } from '../schemas/medicine.schema.js'

/**
 * Internal lookups for the Inventory, Sales and Purchase Services (not exposed by Gateway).
 * No auth middleware — callers are trusted on the Docker network.
 * Public CRUD remains JWT-protected under /api.
 */
const internalCatalogRouter = Router()

internalCatalogRouter.get(
  '/medicines/barcode/:barcode',
  validateRequest({ params: barcodeParamSchema }),
  getMedicineByBarcode,
)

internalCatalogRouter.get(
  '/medicines/:id',
  validateRequest({ params: idParamSchema }),
  getMedicine,
)

internalCatalogRouter.get(
  '/categories/:id',
  validateRequest({ params: idParamSchema }),
  getCategory,
)

export { internalCatalogRouter }
