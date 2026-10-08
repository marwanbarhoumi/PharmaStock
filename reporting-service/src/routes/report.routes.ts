import { Router } from 'express'

import {
  expirationReport,
  exportReport,
  lowStockReport,
  profitReport,
  purchasesReport,
  salesReport,
  stockReport,
} from '../controllers/report.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import {
  expirationReportQuerySchema,
  reportDateQuerySchema,
  reportExportQuerySchema,
} from '../schemas/report.schema.js'

const reportRouter = Router()

reportRouter.use(authenticate)
reportRouter.use(authorize('ADMIN', 'PHARMACIST'))

reportRouter.get(
  '/sales',
  validateRequest({ query: reportDateQuerySchema }),
  salesReport,
)

reportRouter.get(
  '/purchases',
  validateRequest({ query: reportDateQuerySchema }),
  purchasesReport,
)

reportRouter.get(
  '/stock',
  validateRequest({ query: reportDateQuerySchema }),
  stockReport,
)

reportRouter.get(
  '/low-stock',
  validateRequest({ query: reportDateQuerySchema }),
  lowStockReport,
)

reportRouter.get(
  '/expiration',
  validateRequest({ query: expirationReportQuerySchema }),
  expirationReport,
)

reportRouter.get(
  '/profit',
  validateRequest({ query: reportDateQuerySchema }),
  profitReport,
)

reportRouter.get(
  '/export',
  validateRequest({ query: reportExportQuerySchema }),
  exportReport,
)

export { reportRouter }
