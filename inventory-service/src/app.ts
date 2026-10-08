import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'

import { appConfig, getCorsOrigin } from './config/app.js'
import type { Env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { apiRouter, internalInventoryRouter } from './routes/index.js'

export function createApp(env: Env) {
  const app = express()

  app.set('trust proxy', 1)

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )
  app.use(
    cors({
      origin: getCorsOrigin(env),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: appConfig.name,
    })
  })

  // Public limit for these routes. Internal calls from Sales/Purchase
  // (one per sale/purchase line) must not consume the public budget.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many requests, please try again later.',
      },
    }),
    apiRouter,
  )
  app.use('/internal/inventory', internalInventoryRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
