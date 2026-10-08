import express, { type Express, type Request, type Response } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import morgan from 'morgan'

import type { GatewayEnv } from './config/env.js'

function createServiceProxy(
  target: string,
  label: string,
  pathFilter: (pathname: string) => boolean,
) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 60_000,
    timeout: 60_000,
    pathFilter,
    on: {
      error(err, _req, res) {
        console.error(`[gateway] ${label} proxy error`, err.message)
        if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
          const response = res as Response
          if (!response.headersSent) {
            response.status(502).json({
              success: false,
              message: `Upstream ${label} unavailable`,
              errors: [],
            })
          }
        }
      },
    },
  })
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Notification-creating alert check belongs to the Notification Service. */
function isAlertCheck(pathname: string): boolean {
  return matchesPrefix(pathname, '/api/alerts/check')
}

function isNotificationPath(pathname: string): boolean {
  return matchesPrefix(pathname, '/api/notifications') || isAlertCheck(pathname)
}

function isSalesPath(pathname: string): boolean {
  return matchesPrefix(pathname, '/api/sales')
}

function isPurchasePath(pathname: string): boolean {
  return (
    matchesPrefix(pathname, '/api/purchases') ||
    matchesPrefix(pathname, '/api/suppliers')
  )
}

function isReportingPath(pathname: string): boolean {
  return (
    matchesPrefix(pathname, '/api/dashboard') ||
    matchesPrefix(pathname, '/api/reports')
  )
}

function isInventoryPath(pathname: string): boolean {
  if (isAlertCheck(pathname)) return false
  return (
    matchesPrefix(pathname, '/api/batches') ||
    matchesPrefix(pathname, '/api/stock') ||
    matchesPrefix(pathname, '/api/alerts')
  )
}

interface ServiceProbe {
  status: 'up' | 'down'
  database: string
}

async function probeService(baseUrl: string): Promise<ServiceProbe> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    })
    const body = (await response.json().catch(() => ({}))) as { database?: unknown }
    return {
      status: response.ok ? 'up' : 'down',
      database: typeof body.database === 'string' ? body.database : 'disconnected',
    }
  } catch {
    return { status: 'down', database: 'disconnected' }
  }
}

function serviceTargets(env: GatewayEnv) {
  return {
    auth: env.AUTH_URL,
    medicine: env.MEDICINE_URL,
    inventory: env.INVENTORY_URL,
    notification: env.NOTIFICATION_URL,
    sales: env.SALES_URL,
    purchase: env.PURCHASE_URL,
    reporting: env.REPORTING_URL,
  }
}

async function probeAll(env: GatewayEnv): Promise<Record<string, ServiceProbe>> {
  const entries = Object.entries(serviceTargets(env))
  const probes = await Promise.all(entries.map(([, url]) => probeService(url)))
  return Object.fromEntries(entries.map(([name], index) => [name, probes[index]!]))
}

export function createGatewayApp(env: GatewayEnv): Express {
  const app = express()

  app.set('trust proxy', 1)
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  app.get('/gateway/health', async (_req: Request, res: Response) => {
    const probes = await probeAll(env)

    res.status(200).json({
      success: true,
      service: 'pharmastock-gateway',
      mode: 'api-gateway',
      authUrl: env.AUTH_URL,
      medicineUrl: env.MEDICINE_URL,
      inventoryUrl: env.INVENTORY_URL,
      notificationUrl: env.NOTIFICATION_URL,
      salesUrl: env.SALES_URL,
      purchaseUrl: env.PURCHASE_URL,
      reportingUrl: env.REPORTING_URL,
      services: Object.fromEntries(
        Object.entries(probes).map(([name, probe]) => [name, probe.status]),
      ),
    })
  })

  // Public API health. The database is reported as connected only when every
  // service reports it so.
  app.get('/api/health', async (_req: Request, res: Response) => {
    const probes = Object.values(await probeAll(env))
    const notConnected = probes.find((probe) => probe.database !== 'connected')

    res.status(200).json({
      success: true,
      message: 'PharmaStock API is running',
      database: notConnected ? notConnected.database : 'connected',
    })
  })

  const authProxy = createServiceProxy(env.AUTH_URL, 'auth', (pathname) => {
    return (
      matchesPrefix(pathname, '/api/auth') ||
      matchesPrefix(pathname, '/api/audit-logs')
    )
  })

  const medicineProxy = createServiceProxy(
    env.MEDICINE_URL,
    'medicine',
    (pathname) => {
      return (
        matchesPrefix(pathname, '/api/medicines') ||
        matchesPrefix(pathname, '/api/categories')
      )
    },
  )

  const inventoryProxy = createServiceProxy(
    env.INVENTORY_URL,
    'inventory',
    isInventoryPath,
  )

  const notificationProxy = createServiceProxy(
    env.NOTIFICATION_URL,
    'notification',
    isNotificationPath,
  )

  const salesProxy = createServiceProxy(env.SALES_URL, 'sales', isSalesPath)

  const purchaseProxy = createServiceProxy(
    env.PURCHASE_URL,
    'purchase',
    isPurchasePath,
  )

  const reportingProxy = createServiceProxy(
    env.REPORTING_URL,
    'reporting',
    isReportingPath,
  )

  app.use(authProxy)
  app.use(medicineProxy)
  app.use(inventoryProxy)
  app.use(notificationProxy)
  app.use(salesProxy)
  app.use(purchaseProxy)
  app.use(reportingProxy)

  // Unrouted /api paths get the same 404 body as the services.
  app.use((req, res, next) => {
    if (!matchesPrefix(req.path, '/api')) {
      next()
      return
    }
    res.status(404).json({
      success: false,
      message: 'Route not found',
      errors: [],
    })
  })

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Not found',
      errors: [],
    })
  })

  return app
}
