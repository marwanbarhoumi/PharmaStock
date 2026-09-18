import type { Request, Response } from 'express'

import type {
  ApplyStockMovementBody,
  FefoAllocateBody,
  StockListQuery,
  StockMovementsQuery,
} from '../schemas/stock.schema.js'
import { allocateByFefo } from '../services/fefo.service.js'
import { applyStockMovement } from '../services/stock-movement.service.js'
import * as stockService from '../services/stock.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'
import { unauthorized } from '../utils/app-error.js'

export const listStock = asyncHandler(async (req: Request, res: Response) => {
  const result = await stockService.getStockOverview(
    req.query as unknown as StockListQuery,
  )
  sendSuccess({
    res,
    message: 'Stock overview retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getStockByMedicine = asyncHandler(async (req: Request, res: Response) => {
  const stock = await stockService.getStockByMedicineId(
    req.params.medicineId as string,
  )
  sendSuccess({
    res,
    message: 'Medicine stock retrieved successfully',
    data: stock,
  })
})

export const listStockMovements = asyncHandler(async (req: Request, res: Response) => {
  const result = await stockService.getStockMovements(
    req.query as unknown as StockMovementsQuery,
  )
  sendSuccess({
    res,
    message: 'Stock movements retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const createStockMovement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw unauthorized()
  }

  const body = req.body as ApplyStockMovementBody
  const result = await applyStockMovement({
    medicineId: body.medicineId,
    batchId: body.batchId,
    type: body.type,
    quantity: body.quantity,
    reason: body.reason,
    referenceType: body.referenceType,
    referenceId: body.referenceId ?? null,
    performedBy: req.user.id,
  })

  sendCreated(res, 'Stock movement applied successfully', result)
})

export const allocateFefo = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as FefoAllocateBody
  const plan = await allocateByFefo(body.medicineId, body.quantity)
  sendSuccess({
    res,
    message: 'FEFO allocation plan created successfully',
    data: plan,
  })
})
