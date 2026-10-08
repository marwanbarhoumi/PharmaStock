import type { Request, Response } from 'express'

import { loadEnv } from '../config/env.js'
import type {
  InternalAlertsQuery,
  InternalCreateBatchBody,
  InternalFefoBody,
  InternalMovementBody,
  InternalReferencesBody,
} from '../schemas/internal-inventory.schema.js'
import { findExpirationAlerts } from '../services/expiration-alert.service.js'
import { allocateByFefo } from '../services/fefo.service.js'
import { findLowStockAlerts } from '../services/low-stock-alert.service.js'
import * as internalInventory from '../services/internal-inventory.service.js'
import { applyStockMovement } from '../services/stock-movement.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const internalAllocateFefo = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as InternalFefoBody
    const plan = await allocateByFefo(body.medicineId, body.quantity)
    sendSuccess({
      res,
      message: 'FEFO allocation plan created successfully',
      data: plan,
    })
  },
)

export const internalApplyMovement = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as InternalMovementBody
    const result = await applyStockMovement({
      medicineId: body.medicineId,
      batchId: body.batchId,
      type: body.type,
      quantity: body.quantity,
      reason: body.reason,
      referenceType: body.referenceType,
      referenceId: body.referenceId ?? null,
      performedBy: body.performedBy,
    })
    sendCreated(res, 'Stock movement applied successfully', result)
  },
)

export const internalCreateBatch = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as InternalCreateBatchBody
    const batch = await internalInventory.createPurchaseBatch(body)
    sendCreated(res, 'Batch created successfully', batch)
  },
)

export const internalDeleteBatch = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await internalInventory.deletePurchaseBatch(
      req.params.id as string,
    )
    sendSuccess({ res, message: 'Batch removed', data: result })
  },
)

/** Same snapshot as GET /api/alerts, without user auth, for the Notification Service. */
export const internalAlerts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as InternalAlertsQuery
  const warningDays = query.warningDays ?? loadEnv().EXPIRATION_WARNING_DAYS
  const [expiration, lowStock] = await Promise.all([
    findExpirationAlerts(warningDays),
    findLowStockAlerts(),
  ])
  sendSuccess({
    res,
    message: 'Alerts retrieved successfully',
    data: {
      warningDays,
      expiration: { warningDays, items: expiration },
      lowStock: { items: lowStock },
    },
  })
})

export const internalReferences = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as InternalReferencesBody
    const refs = await internalInventory.getReferences(
      body.medicineIds,
      body.batchIds,
      body.includePurchasePrice,
    )
    sendSuccess({ res, message: 'References retrieved successfully', data: refs })
  },
)

export const internalDeactivateBatchIfEmpty = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await internalInventory.deactivateBatchIfEmpty(
      req.params.id as string,
    )
    sendSuccess({ res, message: 'Batch checked for deactivation', data: result })
  },
)
