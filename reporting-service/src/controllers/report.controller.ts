import type { Request, Response } from 'express'

import type {
  ExpirationReportQuery,
  ReportDateQuery,
  ReportExportQuery,
} from '../schemas/report.schema.js'
import * as reportService from '../services/report.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const salesReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getSalesReport(
    req.query as unknown as ReportDateQuery,
  )
  sendSuccess({
    res,
    message: 'Sales report retrieved successfully',
    data: {
      range: result.range,
      summary: result.summary,
      items: result.items,
    },
    pagination: result.pagination,
  })
})

export const purchasesReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getPurchasesReport(
    req.query as unknown as ReportDateQuery,
  )
  sendSuccess({
    res,
    message: 'Purchases report retrieved successfully',
    data: {
      range: result.range,
      summary: result.summary,
      items: result.items,
    },
    pagination: result.pagination,
  })
})

export const stockReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getStockReport(
    req.query as unknown as ReportDateQuery,
  )
  sendSuccess({
    res,
    message: 'Stock report retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const lowStockReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getLowStockReport(
    req.query as unknown as ReportDateQuery,
  )
  sendSuccess({
    res,
    message: 'Low-stock report retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const expirationReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getExpirationReport(
    req.query as unknown as ExpirationReportQuery,
  )
  sendSuccess({
    res,
    message: 'Expiration report retrieved successfully',
    data: {
      warningDays: result.warningDays,
      items: result.items,
    },
    pagination: result.pagination,
  })
})

export const profitReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getProfitReport(
    req.query as unknown as ReportDateQuery,
  )
  sendSuccess({
    res,
    message: 'Profit report retrieved successfully',
    data: {
      range: result.range,
      summary: result.summary,
      note: result.note,
      items: result.items,
    },
    pagination: result.pagination,
  })
})

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ReportExportQuery
  const file = await reportService.buildReportCsv(query)

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename}"`,
  )
  res.status(200).send(file.content)
})
