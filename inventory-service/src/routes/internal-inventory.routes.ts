import { Router } from 'express'

import {
  internalAlerts,
  internalAllocateFefo,
  internalApplyMovement,
  internalCreateBatch,
  internalDeactivateBatchIfEmpty,
  internalDeleteBatch,
  internalReferences,
} from '../controllers/internal-inventory.controller.js'
import { requireInternalToken } from '../middleware/internal-auth.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import {
  internalAlertsQuerySchema,
  internalCreateBatchSchema,
  internalFefoSchema,
  internalMovementSchema,
  internalReferencesSchema,
} from '../schemas/internal-inventory.schema.js'

/**
 * Minimal internal operations required by the Sales, Purchase and
 * Notification Services. Not exposed by the Gateway.
 */
const internalInventoryRouter = Router()

internalInventoryRouter.use(requireInternalToken)

internalInventoryRouter.post(
  '/fefo/allocate',
  validateRequest({ body: internalFefoSchema }),
  internalAllocateFefo,
)

internalInventoryRouter.post(
  '/movements',
  validateRequest({ body: internalMovementSchema }),
  internalApplyMovement,
)

internalInventoryRouter.post(
  '/batches',
  validateRequest({ body: internalCreateBatchSchema }),
  internalCreateBatch,
)

internalInventoryRouter.delete(
  '/batches/:id',
  validateRequest({ params: idParamSchema }),
  internalDeleteBatch,
)

internalInventoryRouter.post(
  '/batches/:id/deactivate-if-empty',
  validateRequest({ params: idParamSchema }),
  internalDeactivateBatchIfEmpty,
)

internalInventoryRouter.get(
  '/alerts',
  validateRequest({ query: internalAlertsQuerySchema }),
  internalAlerts,
)

internalInventoryRouter.post(
  '/references',
  validateRequest({ body: internalReferencesSchema }),
  internalReferences,
)

export { internalInventoryRouter }
