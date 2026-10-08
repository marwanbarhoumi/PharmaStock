import type { Request, Response } from 'express'

import type { DashboardQuery } from '../schemas/report.schema.js'
import * as dashboardService from '../services/dashboard.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getDashboardSummary(
    req.query as unknown as DashboardQuery,
  )
  sendSuccess({
    res,
    message: 'Dashboard summary retrieved successfully',
    data,
  })
})

export const getCharts = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getDashboardCharts(
    req.query as unknown as DashboardQuery,
  )
  sendSuccess({
    res,
    message: 'Dashboard charts retrieved successfully',
    data,
  })
})

export const getRecent = asyncHandler(async (_req: Request, res: Response) => {
  const data = await dashboardService.getDashboardRecent()
  sendSuccess({
    res,
    message: 'Dashboard recent activity retrieved successfully',
    data,
  })
})
