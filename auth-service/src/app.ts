import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'

import { getCorsOrigin } from './config/app.js'
import type { Env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { apiRouter, internalAuthRouter } from './routes/index.js'

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
  app.use(
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
  )

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'PharmaStock Auth Service',
    })
  })

  // Public API paths (Gateway forwards /api/auth and /api/audit-logs here).
  app.use('/api', apiRouter)

  // Internal service-to-service introspection (not exposed by Gateway).
  app.use('/internal/auth', internalAuthRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
