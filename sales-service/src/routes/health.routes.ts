import { Router } from 'express'

import { getDatabaseStatus } from '../config/database.js'

const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'PharmaStock Sales Service is running',
    database: getDatabaseStatus(),
    service: 'sales',
  })
})

export { healthRouter }
