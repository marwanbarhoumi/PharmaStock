import type { Request, Response } from 'express'

import type { CreateSaleInput, SaleListQuery } from '../schemas/sale.schema.js'
import { recordAuditLog } from '../services/audit-log.service.js'
import * as saleService from '../services/sale.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'
import { unauthorized } from '../utils/app-error.js'

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  const result = await saleService.getSales(req.query as unknown as SaleListQuery)
  sendSuccess({
    res,
    message: 'Sales retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getSale = asyncHandler(async (req: Request, res: Response) => {
  const sale = await saleService.getSaleById(req.params.id as string)
  sendSuccess({
    res,
    message: 'Sale retrieved successfully',
    data: sale,
  })
})

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw unauthorized()
  }

  const sale = await saleService.createSale(
    req.body as CreateSaleInput,
    req.user.id,
  )
  void recordAuditLog({
    userId: req.user.id,
    action: 'CREATE_SALE',
    entity: 'Sale',
    entityId: sale._id ? String(sale._id) : null,
    description: `Sale ${sale.invoiceNumber} created`,
    ipAddress: req.ip,
  })
  sendCreated(res, 'Sale created successfully', sale)
})

export const cancelSale = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw unauthorized()
  }

  const sale = await saleService.cancelSale(req.params.id as string, req.user.id)
  void recordAuditLog({
    userId: req.user.id,
    action: 'CANCEL_SALE',
    entity: 'Sale',
    entityId: sale._id ? String(sale._id) : null,
    description: `Sale ${sale.invoiceNumber} cancelled`,
    ipAddress: req.ip,
  })
  sendSuccess({
    res,
    message: 'Sale cancelled successfully',
    data: sale,
  })
})
