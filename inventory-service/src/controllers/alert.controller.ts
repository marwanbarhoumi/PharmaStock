import type { Request, Response } from 'express'

import { loadEnv } from '../config/env.js'
import { findExpirationAlerts } from '../services/expiration-alert.service.js'
import { findLowStockAlerts } from '../services/low-stock-alert.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const listAlerts = asyncHandler(async (_req: Request, res: Response) => {
  const env = loadEnv()
  const [expiration, lowStock] = await Promise.all([
    findExpirationAlerts(env.EXPIRATION_WARNING_DAYS),
    findLowStockAlerts(),
  ])

  sendSuccess({
    res,
    message: 'Alerts retrieved successfully',
    data: {
      warningDays: env.EXPIRATION_WARNING_DAYS,
      expiration: {
        warningDays: env.EXPIRATION_WARNING_DAYS,
        items: expiration,
      },
      lowStock: {
        items: lowStock,
      },
    },
  })
})

export const listExpirationAlerts = asyncHandler(
  async (_req: Request, res: Response) => {
    const env = loadEnv()
    const expiration = await findExpirationAlerts(env.EXPIRATION_WARNING_DAYS)

    sendSuccess({
      res,
      message: 'Expiration alerts retrieved successfully',
      data: {
        warningDays: env.EXPIRATION_WARNING_DAYS,
        items: expiration,
      },
    })
  },
)

export const listLowStockAlerts = asyncHandler(
  async (_req: Request, res: Response) => {
    const lowStock = await findLowStockAlerts()

    sendSuccess({
      res,
      message: 'Low-stock alerts retrieved successfully',
      data: {
        items: lowStock,
      },
    })
  },
)
