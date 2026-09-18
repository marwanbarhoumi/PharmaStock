import { Router } from 'express'

import { listAuditLogs } from '../controllers/audit-log.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validate.js'
import { auditLogListQuerySchema } from '../schemas/audit-log.schema.js'

const auditLogRouter = Router()

auditLogRouter.use(authenticate, authorize('ADMIN'))

auditLogRouter.get(
  '/',
  validateRequest({ query: auditLogListQuerySchema }),
  listAuditLogs,
)

export { auditLogRouter }
