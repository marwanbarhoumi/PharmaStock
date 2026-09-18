import type { Request, Response } from 'express'

import { getDatabaseStatus } from '../config/database.js'

export function getHealth(_req: Request, res: Response): void {
  const database = getDatabaseStatus()

  res.status(200).json({
    success: true,
    message: 'PharmaStock API is running',
    database,
  })
}
