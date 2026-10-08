import { Router } from 'express'

import { runAlertCheck } from '../controllers/alert-check.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'

/**
 * Only the notification-creating check lives here. Read-only alert snapshots
 * (GET /api/alerts, /expiration, /low-stock) are owned by the Inventory Service.
 */
const alertCheckRouter = Router()

alertCheckRouter.use(authenticate)

alertCheckRouter.post('/check', authorize('ADMIN', 'PHARMACIST'), runAlertCheck)

export { alertCheckRouter }
