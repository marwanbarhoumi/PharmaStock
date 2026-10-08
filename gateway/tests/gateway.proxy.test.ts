import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'

import { createGatewayApp } from '../src/app.js'
import { loadGatewayEnv, resetGatewayEnvCache } from '../src/config/env.js'

const SERVICE_NAMES = [
  'auth',
  'medicine',
  'inventory',
  'notification',
  'sales',
  'purchase',
  'reporting',
] as const
type ServiceName = (typeof SERVICE_NAMES)[number]

interface MockService {
  server: http.Server
  port: number
  lastPath: string
  lastMethod: string
  lastAuthorization: string | undefined
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

describe('gateway proxy', () => {
  const mocks = {} as Record<ServiceName, MockService>

  function createMock(name: ServiceName): MockService {
    const mock: MockService = {
      server: http.createServer(),
      port: 0,
      lastPath: '',
      lastMethod: '',
      lastAuthorization: undefined,
    }
    mock.server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = req.url ?? ''
      if (url === '/api/health') {
        json(res, 200, { success: true, service: name, database: 'connected' })
        return
      }
      mock.lastPath = url
      mock.lastMethod = req.method ?? ''
      mock.lastAuthorization = req.headers.authorization
      if (name === 'auth' && url.startsWith('/api/auth/me')) {
        json(res, 200, { success: true, data: { email: 'admin@pharmastock.local', role: 'ADMIN' } })
        return
      }
      if (name === 'medicine' && url.startsWith('/api/medicines')) {
        json(res, 200, { success: true, data: [{ name: 'Aspirin' }] })
        return
      }
      if (name === 'reporting' && url.startsWith('/api/reports/export')) {
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sales-report-2026-01-01.csv"',
        })
        res.end('invoiceNumber,total\n')
        return
      }
      json(res, 200, { success: true, data: { source: name } })
    })
    return mock
  }

  function resetPaths() {
    for (const name of SERVICE_NAMES) {
      mocks[name].lastPath = ''
      mocks[name].lastMethod = ''
    }
  }

  function hits(): Partial<Record<ServiceName, string>> {
    return Object.fromEntries(
      SERVICE_NAMES.filter((name) => mocks[name].lastPath).map((name) => [name, mocks[name].lastPath]),
    )
  }

  before(async () => {
    await Promise.all(
      SERVICE_NAMES.map(
        (name) =>
          new Promise<void>((resolve) => {
            const mock = createMock(name)
            mocks[name] = mock
            mock.server.listen(0, '127.0.0.1', () => {
              const address = mock.server.address()
              if (address && typeof address === 'object') {
                mock.port = address.port
              }
              resolve()
            })
          }),
      ),
    )
  })

  after(async () => {
    await Promise.all(
      SERVICE_NAMES.map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            mocks[name].server.close((error) => (error ? reject(error) : resolve()))
          }),
      ),
    )
  })

  function gatewayEnv(overrides: Record<string, string> = {}) {
    resetGatewayEnvCache()
    return loadGatewayEnv({
      NODE_ENV: 'test',
      PORT: '5099',
      AUTH_URL: `http://127.0.0.1:${mocks.auth.port}`,
      MEDICINE_URL: `http://127.0.0.1:${mocks.medicine.port}`,
      INVENTORY_URL: `http://127.0.0.1:${mocks.inventory.port}`,
      NOTIFICATION_URL: `http://127.0.0.1:${mocks.notification.port}`,
      SALES_URL: `http://127.0.0.1:${mocks.sales.port}`,
      PURCHASE_URL: `http://127.0.0.1:${mocks.purchase.port}`,
      REPORTING_URL: `http://127.0.0.1:${mocks.reporting.port}`,
      CLIENT_URL: 'http://localhost:5173',
      CORS_ORIGINS: '',
      ...overrides,
    })
  }

  it('exposes gateway liveness with every service target and no monolith', async () => {
    const app = createGatewayApp(gatewayEnv())
    const response = await request(app).get('/gateway/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.service, 'pharmastock-gateway')
    assert.equal(response.body.mode, 'api-gateway')
    for (const name of SERVICE_NAMES) {
      assert.ok(String(response.body[`${name}Url`]).includes(String(mocks[name].port)), name)
    }
    assert.equal(response.body.monolithUrl, undefined)
    assert.deepEqual(response.body.services, {
      auth: 'up',
      medicine: 'up',
      inventory: 'up',
      notification: 'up',
      sales: 'up',
      purchase: 'up',
      reporting: 'up',
    })
  })

  for (const name of SERVICE_NAMES) {
    it(`reports ${name} as down when unreachable without failing liveness`, async () => {
      const env = gatewayEnv({ [`${name.toUpperCase()}_URL`]: 'http://127.0.0.1:1' })
      const response = await request(createGatewayApp(env)).get('/gateway/health')
      assert.equal(response.status, 200)
      assert.equal(response.body.services[name], 'down')
      for (const other of SERVICE_NAMES.filter((service) => service !== name)) {
        assert.equal(response.body.services[other], 'up', other)
      }
    })
  }

  it('answers /api/health itself with the public API health shape', async () => {
    resetPaths()
    const app = createGatewayApp(gatewayEnv())
    const response = await request(app).get('/api/health')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      success: true,
      message: 'PharmaStock API is running',
      database: 'connected',
    })
    assert.deepEqual(hits(), {})
  })

  it('reports the database as disconnected on /api/health when a service is down', async () => {
    const app = createGatewayApp(gatewayEnv({ SALES_URL: 'http://127.0.0.1:1' }))
    const response = await request(app).get('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.message, 'PharmaStock API is running')
    assert.equal(response.body.database, 'disconnected')
  })

  it('proxies /api/auth/* and /api/audit-logs to the auth service', async () => {
    const app = createGatewayApp(gatewayEnv())
    const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer test-token')
    assert.equal(me.status, 200)
    assert.equal(mocks.auth.lastPath, '/api/auth/me')
    assert.equal(mocks.auth.lastAuthorization, 'Bearer test-token')
    assert.equal(me.body.data.role, 'ADMIN')

    const logs = await request(app).get('/api/audit-logs').set('Authorization', 'Bearer test-token')
    assert.equal(logs.status, 200)
    assert.equal(mocks.auth.lastPath, '/api/audit-logs')
  })

  it('proxies /api/medicines/* and /api/categories/* to the medicine service', async () => {
    const app = createGatewayApp(gatewayEnv())
    const medicines = await request(app).get('/api/medicines')
    assert.equal(medicines.status, 200)
    assert.equal(mocks.medicine.lastPath, '/api/medicines')
    assert.equal(medicines.body.data[0].name, 'Aspirin')

    await request(app).get('/api/medicines/barcode/123')
    assert.equal(mocks.medicine.lastPath, '/api/medicines/barcode/123')

    const categories = await request(app).get('/api/categories')
    assert.equal(categories.status, 200)
    assert.equal(mocks.medicine.lastPath, '/api/categories')
  })

  it('proxies batches, stock, and alert reads to the inventory service', async () => {
    const app = createGatewayApp(gatewayEnv())
    for (const path of [
      '/api/batches',
      '/api/batches/abc',
      '/api/stock',
      '/api/stock/movements?page=1',
      '/api/stock/fefo/allocate',
      '/api/alerts',
      '/api/alerts/expiration',
      '/api/alerts/low-stock',
    ]) {
      resetPaths()
      const response = await request(app).get(path)
      assert.equal(response.status, 200, path)
      assert.equal(response.body.data.source, 'inventory', path)
      assert.deepEqual(hits(), { inventory: path })
    }

    const movement = await request(app).post('/api/stock/movements').send({ quantity: 1 })
    assert.equal(movement.body.data.source, 'inventory')
    assert.equal(mocks.inventory.lastMethod, 'POST')
  })

  it('routes POST /api/alerts/check to the notification service', async () => {
    const app = createGatewayApp(gatewayEnv())
    resetPaths()
    const response = await request(app).post('/api/alerts/check')
    assert.equal(response.status, 200)
    assert.equal(response.body.data.source, 'notification')
    assert.deepEqual(hits(), { notification: '/api/alerts/check' })
    assert.equal(mocks.notification.lastMethod, 'POST')
  })

  it('routes /api/notifications/* to the notification service', async () => {
    const app = createGatewayApp(gatewayEnv())
    for (const [method, path] of [
      ['get', '/api/notifications'],
      ['get', '/api/notifications?isRead=false&page=2'],
      ['get', '/api/notifications/unread-count'],
      ['patch', '/api/notifications/read-all'],
      ['patch', '/api/notifications/abc/read'],
    ] as const) {
      resetPaths()
      const response = await request(app)[method](path)
      assert.equal(response.status, 200, path)
      assert.equal(response.body.data.source, 'notification', path)
      assert.deepEqual(hits(), { notification: path })
      assert.equal(mocks.notification.lastMethod, method.toUpperCase())
    }
  })

  it('routes /api/sales/* to the sales service', async () => {
    const app = createGatewayApp(gatewayEnv())
    for (const [method, path] of [
      ['get', '/api/sales'],
      ['get', '/api/sales?page=2&status=COMPLETED'],
      ['post', '/api/sales'],
      ['get', '/api/sales/abc'],
      ['post', '/api/sales/abc/cancel'],
    ] as const) {
      resetPaths()
      const response = await request(app)[method](path).send({})
      assert.equal(response.status, 200, path)
      assert.equal(response.body.data.source, 'sales', path)
      assert.deepEqual(hits(), { sales: path })
      assert.equal(mocks.sales.lastMethod, method.toUpperCase())
    }
  })

  it('routes /api/purchases/* and /api/suppliers/* to the purchase service', async () => {
    const app = createGatewayApp(gatewayEnv())
    for (const [method, path] of [
      ['get', '/api/purchases'],
      ['get', '/api/purchases?page=2&status=PENDING'],
      ['post', '/api/purchases'],
      ['get', '/api/purchases/abc'],
      ['post', '/api/purchases/abc/receive'],
      ['post', '/api/purchases/abc/cancel'],
      ['get', '/api/suppliers'],
      ['post', '/api/suppliers'],
      ['get', '/api/suppliers/abc'],
      ['put', '/api/suppliers/abc'],
      ['delete', '/api/suppliers/abc'],
    ] as const) {
      resetPaths()
      const response = await request(app)[method](path).send({})
      assert.equal(response.status, 200, path)
      assert.equal(response.body.data.source, 'purchase', path)
      assert.deepEqual(hits(), { purchase: path })
      assert.equal(mocks.purchase.lastMethod, method.toUpperCase())
    }
  })

  it('routes /api/dashboard/* and /api/reports/* to the reporting service', async () => {
    const app = createGatewayApp(gatewayEnv())
    for (const path of [
      '/api/dashboard/summary',
      '/api/dashboard/charts?from=2026-01-01&to=2026-01-31',
      '/api/dashboard/recent',
      '/api/reports/sales?page=2',
      '/api/reports/purchases',
      '/api/reports/stock',
      '/api/reports/low-stock',
      '/api/reports/expiration?warningDays=60',
      '/api/reports/profit',
    ]) {
      resetPaths()
      const response = await request(app).get(path)
      assert.equal(response.status, 200, path)
      assert.equal(response.body.data.source, 'reporting', path)
      assert.deepEqual(hits(), { reporting: path })
    }

    const csv = await request(app).get('/api/reports/export?type=sales')
    assert.equal(csv.status, 200)
    assert.equal(csv.headers['content-type'], 'text/csv; charset=utf-8')
    assert.equal(csv.headers['content-disposition'], 'attachment; filename="sales-report-2026-01-01.csv"')
    assert.equal(csv.text, 'invoiceNumber,total\n')
  })

  it('returns 404 for look-alike prefixes and unknown /api paths without reaching any service', async () => {
    const app = createGatewayApp(gatewayEnv())
    for (const path of [
      '/api/authx',
      '/api/audit-logsx',
      '/api/medicinesx',
      '/api/categoriesx',
      '/api/batchesx',
      '/api/stockpile',
      '/api/alertsx',
      '/api/notificationsx',
      '/api/salesx',
      '/api/purchasesx',
      '/api/suppliersx',
      '/api/dashboardx',
      '/api/reportsx',
      '/api/reportsex',
      '/api/legacy',
      '/api/users',
      '/api',
    ]) {
      resetPaths()
      const response = await request(app).get(path)
      assert.equal(response.status, 404, path)
      assert.deepEqual(response.body, { success: false, message: 'Route not found', errors: [] }, path)
      assert.deepEqual(hits(), {}, path)
    }
  })

  it('never exposes /internal/* routes', async () => {
    const app = createGatewayApp(gatewayEnv())
    resetPaths()
    for (const path of [
      '/internal/inventory/alerts',
      '/internal/inventory/references',
      '/internal/inventory/movements',
      '/internal/inventory/fefo/allocate',
      '/internal/inventory/batches',
      '/internal/auth/introspect',
      '/internal/catalog/medicines/abc',
      '/internal/sales',
      '/internal/purchases',
      '/internal/reports',
      '/internal/dashboard',
    ]) {
      const response = await request(app).post(path).send({})
      assert.equal(response.status, 404, path)
      assert.equal(response.body.success, false, path)
    }
    assert.deepEqual(hits(), {})
  })
})
