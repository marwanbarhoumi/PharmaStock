import type { Request, Response } from 'express'

import { runStockChecks } from '../services/stock-check.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const runAlertCheck = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await runStockChecks()

  sendSuccess({
    res,
    message: 'Stock checks completed successfully',
    data: summary,
  })
})
