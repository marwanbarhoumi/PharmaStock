import type { Request, Response } from 'express'

import type {
  CreatePurchaseInput,
  PurchaseListQuery,
} from '../schemas/purchase.schema.js'
import { recordAuditLog } from '../services/audit-log.service.js'
import * as purchaseService from '../services/purchase.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'
import { unauthorized } from '../utils/app-error.js'

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.getPurchases(
    req.query as unknown as PurchaseListQuery,
  )
  sendSuccess({
    res,
    message: 'Purchases retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await purchaseService.getPurchaseById(req.params.id as string)
  sendSuccess({
    res,
    message: 'Purchase retrieved successfully',
    data: purchase,
  })
})

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw unauthorized()
  }

  const purchase = await purchaseService.createPurchase(
    req.body as CreatePurchaseInput,
    req.user.id,
  )
  void recordAuditLog({
    userId: req.user.id,
    action: 'CREATE_PURCHASE',
    entity: 'Purchase',
    entityId: purchase._id ? String(purchase._id) : null,
    description: `Purchase ${purchase.purchaseNumber} created`,
    ipAddress: req.ip,
  })
  sendCreated(res, 'Purchase created successfully', purchase)
})

export const receivePurchase = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw unauthorized()
  }

  const purchase = await purchaseService.receivePurchase(
    req.params.id as string,
    req.user.id,
  )
  sendSuccess({
    res,
    message: 'Purchase received successfully',
    data: purchase,
  })
})

export const cancelPurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await purchaseService.cancelPurchase(req.params.id as string)
  sendSuccess({
    res,
    message: 'Purchase cancelled successfully',
    data: purchase,
  })
})
