import { Router } from 'express'

import {
  createMedicine,
  deleteMedicine,
  getMedicine,
  getMedicineByBarcode,
  listMedicines,
  updateMedicine,
} from '../controllers/medicine.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  barcodeParamSchema,
  createMedicineSchema,
  medicineListQuerySchema,
  updateMedicineSchema,
} from '../schemas/medicine.schema.js'

const medicineRouter = Router()

medicineRouter.use(authenticate)

medicineRouter.get(
  '/',
  validateRequest({ query: medicineListQuerySchema }),
  listMedicines,
)

medicineRouter.get(
  '/barcode/:barcode',
  validateRequest({ params: barcodeParamSchema }),
  getMedicineByBarcode,
)

medicineRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getMedicine,
)

medicineRouter.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ body: createMedicineSchema }),
  createMedicine,
)

medicineRouter.put(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema, body: updateMedicineSchema }),
  updateMedicine,
)

medicineRouter.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  validateRequest({ params: idParamSchema }),
  deleteMedicine,
)

export { medicineRouter }
