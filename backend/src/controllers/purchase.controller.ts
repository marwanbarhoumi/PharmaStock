import type { Request, Response } from 'express'

import type { PurchaseListQuery } from '../schemas/purchase.schema.js'
import * as purchaseService from '../services/purchase.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

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
