import type { Request, Response } from 'express'

import type { SaleListQuery } from '../schemas/sale.schema.js'
import * as saleService from '../services/sale.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

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
