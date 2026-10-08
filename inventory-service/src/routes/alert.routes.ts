import { Router } from 'express'

import {
  listAlerts,
  listExpirationAlerts,
  listLowStockAlerts,
} from '../controllers/alert.controller.js'
import { authenticate } from '../middleware/authenticate.js'

/**
 * Read-only alert snapshots. POST /api/alerts/check creates notifications and
 * belongs to the Notification Service.
 */
const alertRouter = Router()

alertRouter.use(authenticate)

alertRouter.get('/', listAlerts)
alertRouter.get('/expiration', listExpirationAlerts)
alertRouter.get('/low-stock', listLowStockAlerts)

export { alertRouter }
