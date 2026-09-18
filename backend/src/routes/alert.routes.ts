import { Router } from 'express'

import {
  listAlerts,
  listExpirationAlerts,
  listLowStockAlerts,
  runAlertCheck,
} from '../controllers/alert.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'

const alertRouter = Router()

alertRouter.use(authenticate)

alertRouter.get('/', listAlerts)
alertRouter.get('/expiration', listExpirationAlerts)
alertRouter.get('/low-stock', listLowStockAlerts)

alertRouter.post(
  '/check',
  authorize('ADMIN', 'PHARMACIST'),
  runAlertCheck,
)

export { alertRouter }
