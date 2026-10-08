import { Router } from 'express'

import {
  getCharts,
  getRecent,
  getSummary,
} from '../controllers/dashboard.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateRequest } from '../middleware/validate.js'
import { dashboardQuerySchema } from '../schemas/report.schema.js'

const dashboardRouter = Router()

dashboardRouter.use(authenticate)

dashboardRouter.get(
  '/summary',
  validateRequest({ query: dashboardQuerySchema }),
  getSummary,
)

dashboardRouter.get(
  '/charts',
  validateRequest({ query: dashboardQuerySchema }),
  getCharts,
)

dashboardRouter.get('/recent', getRecent)

export { dashboardRouter }
