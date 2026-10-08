import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Express } from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { Notification, User } from '../src/models/index.js'
import {
  isStockCheckSchedulerStarted,
  startStockCheckScheduler,
  stopStockCheckScheduler,
} from '../src/services/stock-check-scheduler.js'
import { runStockChecks } from '../src/services/stock-check.service.js'
import type { UserRole } from '../src/types/enums.js'
import { signAccessToken } from '../src/utils/jwt.js'

const JWT_SECRET = 'test_jwt_secret_key_123'

interface MockUser {
  id: string
  email: string
  role: UserRole
  isActive: boolean
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => resolve(raw ? JSON.parse(raw) : undefined))
  })
}

const oid = () => new mongoose.Types.ObjectId().toString()

describe('Notification Service', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let inventoryServer: Server
  let authServer: Server
  let inventoryUrl = ''
  let authUrl = ''

  const inventory = {
    down: false,
    refsDown: false,
    alertCalls: 0,
    lastToken: undefined as string | undefined,
    lastWarningDays: '' as string | null,
    expiration: [] as unknown[],
    lowStock: [] as unknown[],
    medicines: [] as Array<{ _id: string; name: string; barcode: string }>,
    batches: [] as Array<{
      _id: string
      batchNumber: string
      expirationDate: string
      quantity: number
    }>,
  }

  const users: Record<string, MockUser & { token: string }> = {}
  const introspection = new Map<string, MockUser>()

  const medA = oid()
  const medB = oid()
  const batchA = oid()

  function expiredItem() {
    return {
      medicineId: medA,
      medicineName: 'Amoxicillin',
      medicineBarcode: 'AMX',
      batchId: batchA,
      batchNumber: 'AMX-01',
      quantity: 4,
      expirationDate: '2020-01-15T00:00:00.000Z',
      daysUntilExpiration: -100,
      status: 'EXPIRED',
    }
  }

  function lowStockItem(medicineId = medB, name = 'Paracetamol') {
    return {
      medicineId,
      medicineName: name,
      medicineBarcode: 'PCM',
      unit: 'box',
      minimumStock: 20,
      totalQuantity: 3,
      deficit: 17,
    }
  }

  before(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_EXPIRES_IN = '1h'
    process.env.EXPIRATION_WARNING_DAYS = '30'
    process.env.STOCK_CHECK_ENABLED = 'false'
    delete process.env.AUTH_SERVICE_URL
    delete process.env.INTERNAL_API_TOKEN

    inventoryServer = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
      inventory.lastToken = req.headers['x-internal-token'] as string | undefined
      res.setHeader('Content-Type', 'application/json')
      if (inventory.down) {
        res.writeHead(503).end(JSON.stringify({ success: false, message: 'down' }))
        return
      }
      if (req.method === 'GET' && url.pathname === '/internal/inventory/alerts') {
        inventory.alertCalls += 1
        inventory.lastWarningDays = url.searchParams.get('warningDays')
        const warningDays = Number(url.searchParams.get('warningDays') ?? 30)
        res.writeHead(200).end(
          JSON.stringify({
            success: true,
            data: {
              warningDays,
              expiration: { warningDays, items: inventory.expiration },
              lowStock: { items: inventory.lowStock },
            },
          }),
        )
        return
      }
      if (req.method === 'POST' && url.pathname === '/internal/inventory/references') {
        const body = (await readBody(req)) as { medicineIds: string[]; batchIds: string[] }
        if (inventory.refsDown) {
          res.writeHead(500).end(JSON.stringify({ success: false }))
          return
        }
        res.writeHead(200).end(
          JSON.stringify({
            success: true,
            data: {
              medicines: inventory.medicines.filter((m) => body.medicineIds.includes(m._id)),
              batches: inventory.batches.filter((b) => body.batchIds.includes(b._id)),
            },
          }),
        )
        return
      }
      res.writeHead(404).end(JSON.stringify({ success: false }))
    })
    inventoryUrl = await listen(inventoryServer)
    process.env.INVENTORY_SERVICE_URL = inventoryUrl

    authServer = createServer((req, res) => {
      const token = (req.headers.authorization ?? '').replace('Bearer ', '')
      const user = introspection.get(token)
      res.setHeader('Content-Type', 'application/json')
      if (req.url !== '/internal/auth/introspect' || !user || !user.isActive) {
        res.writeHead(401).end(JSON.stringify({ success: false }))
        return
      }
      res.writeHead(200).end(
        JSON.stringify({
          success: true,
          data: { active: true, user, claims: { sub: user.id, email: user.email, role: user.role } },
        }),
      )
    })
    authUrl = await listen(authServer)

    mongo = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongo.getUri()
    await mongoose.connect(mongo.getUri())
    app = createApp(loadEnv())

    const specs: Array<[string, UserRole, boolean]> = [
      ['admin', 'ADMIN', true],
      ['pharmacist', 'PHARMACIST', true],
      ['employee', 'EMPLOYEE', true],
      ['inactiveAdmin', 'ADMIN', false],
    ]
    for (const [key, role, isActive] of specs) {
      const doc = await User.create({
        firstName: key,
        lastName: 'User',
        email: `${key.toLowerCase()}@notification.test`,
        password: 'not-used-hash',
        role,
        isActive,
      })
      const user: MockUser = { id: doc._id.toString(), email: doc.email, role, isActive }
      const token = signAccessToken(
        { sub: user.id, email: user.email, role },
        JWT_SECRET,
        '1h',
      )
      users[key] = { ...user, token }
      introspection.set(token, user)
    }
  })

  after(async () => {
    stopStockCheckScheduler()
    await new Promise<void>((resolve) => inventoryServer.close(() => resolve()))
    await new Promise<void>((resolve) => authServer.close(() => resolve()))
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    delete process.env.AUTH_SERVICE_URL
    delete process.env.INTERNAL_API_TOKEN
    inventory.down = false
    inventory.refsDown = false
    inventory.expiration = []
    inventory.lowStock = []
    inventory.medicines = []
    inventory.batches = []
    await Notification.deleteMany({})
  })

  const auth = (key: string) => ({ Authorization: `Bearer ${users[key]!.token}` })

  it('exposes a public health endpoint', async () => {
    const res = await request(app).get('/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.service, 'notification')
  })

  it('requires authentication on every notification route', async () => {
    for (const [method, path] of [
      ['get', '/api/notifications'],
      ['get', '/api/notifications/unread-count'],
      ['patch', '/api/notifications/read-all'],
      ['patch', `/api/notifications/${oid()}/read`],
      ['post', '/api/alerts/check'],
    ] as const) {
      const res = await request(app)[method](path)
      assert.equal(res.status, 401, `${method} ${path}`)
    }
  })

  it('lists only the caller\u2019s notifications with pagination, filters and populated refs', async () => {
    inventory.medicines = [{ _id: medA, name: 'Amoxicillin', barcode: 'AMX' }]
    inventory.batches = [
      { _id: batchA, batchNumber: 'AMX-01', expirationDate: '2020-01-15T00:00:00.000Z', quantity: 4 },
    ]
    await Notification.create([
      { user: users.admin!.id, type: 'SYSTEM', title: 'A1', message: 'm', severity: 'INFO' },
      {
        user: users.admin!.id,
        type: 'EXPIRED_MEDICINE',
        title: 'A2',
        message: 'm',
        severity: 'CRITICAL',
        relatedMedicine: medA,
        relatedBatch: batchA,
      },
      {
        user: users.admin!.id,
        type: 'LOW_STOCK',
        title: 'A3',
        message: 'm',
        severity: 'WARNING',
        isRead: true,
        relatedMedicine: oid(),
      },
      { user: users.employee!.id, type: 'SYSTEM', title: 'E1', message: 'm', severity: 'INFO' },
    ])

    const list = await request(app).get('/api/notifications').set(auth('admin'))
    assert.equal(list.status, 200)
    assert.equal(list.body.message, 'Notifications retrieved successfully')
    assert.equal(list.body.data.length, 3)
    assert.equal(list.body.pagination.total, 3)

    const expired = list.body.data.find((n: { title: string }) => n.title === 'A2')
    assert.deepEqual(expired.relatedMedicine, { _id: medA, name: 'Amoxicillin', barcode: 'AMX' })
    assert.equal(expired.relatedBatch.batchNumber, 'AMX-01')
    const unresolved = list.body.data.find((n: { title: string }) => n.title === 'A3')
    assert.equal(unresolved.relatedMedicine, null, 'missing reference becomes null like populate')
    const plain = list.body.data.find((n: { title: string }) => n.title === 'A1')
    assert.equal(plain.relatedMedicine, null)

    const unreadOnly = await request(app).get('/api/notifications?isRead=false').set(auth('admin'))
    assert.equal(unreadOnly.body.data.length, 2)
    const critical = await request(app).get('/api/notifications?severity=CRITICAL').set(auth('admin'))
    assert.equal(critical.body.data.length, 1)
    const paged = await request(app).get('/api/notifications?page=1&limit=1').set(auth('admin'))
    assert.equal(paged.body.data.length, 1)
    assert.equal(paged.body.pagination.totalPages, 3)
    const badType = await request(app).get('/api/notifications?type=NOPE').set(auth('admin'))
    assert.equal(badType.status, 422)

    const employee = await request(app).get('/api/notifications').set(auth('employee'))
    assert.equal(employee.body.data.length, 1)
    assert.equal(employee.body.data[0].title, 'E1')
  })

  it('keeps notifications visible when Inventory cannot resolve references', async () => {
    inventory.refsDown = true
    await Notification.create({
      user: users.admin!.id,
      type: 'LOW_STOCK',
      title: 'L',
      message: 'm',
      severity: 'WARNING',
      relatedMedicine: medB,
    })
    const list = await request(app).get('/api/notifications').set(auth('admin'))
    assert.equal(list.status, 200)
    assert.deepEqual(list.body.data[0].relatedMedicine, { _id: medB })
  })

  it('returns the unread count, marks one read and enforces ownership', async () => {
    const [mine, other] = await Notification.create([
      { user: users.admin!.id, type: 'SYSTEM', title: 'Mine', message: 'm', severity: 'INFO' },
      { user: users.employee!.id, type: 'SYSTEM', title: 'Other', message: 'm', severity: 'INFO' },
    ])

    const count = await request(app).get('/api/notifications/unread-count').set(auth('admin'))
    assert.equal(count.status, 200)
    assert.equal(count.body.message, 'Unread notification count retrieved successfully')
    assert.deepEqual(count.body.data, { count: 1 })

    const mark = await request(app)
      .patch(`/api/notifications/${mine!._id}/read`)
      .set(auth('admin'))
    assert.equal(mark.status, 200)
    assert.equal(mark.body.message, 'Notification marked as read')
    assert.equal(mark.body.data.isRead, true)
    assert.equal(mark.body.data._id, String(mine!._id))

    const again = await request(app)
      .patch(`/api/notifications/${mine!._id}/read`)
      .set(auth('admin'))
    assert.equal(again.status, 200, 'marking an already-read notification is idempotent')

    const foreign = await request(app)
      .patch(`/api/notifications/${other!._id}/read`)
      .set(auth('admin'))
    assert.equal(foreign.status, 403)
    assert.equal(foreign.body.message, 'You can only update your own notifications')
    assert.equal((await Notification.findById(other!._id))?.isRead, false)

    const foreignGet = await request(app).get(`/api/notifications/${other!._id}`).set(auth('admin'))
    assert.equal(foreignGet.status, 403)
    assert.equal(foreignGet.body.message, 'You can only access your own notifications')

    const ownGet = await request(app).get(`/api/notifications/${mine!._id}`).set(auth('admin'))
    assert.equal(ownGet.status, 200)

    const missing = await request(app).patch(`/api/notifications/${oid()}/read`).set(auth('admin'))
    assert.equal(missing.status, 404)
    const invalid = await request(app).patch('/api/notifications/not-an-id/read').set(auth('admin'))
    assert.equal(invalid.status, 422)

    const after = await request(app).get('/api/notifications/unread-count').set(auth('admin'))
    assert.equal(after.body.data.count, 0)
  })

  it('marks all as read only for the caller', async () => {
    await Notification.create([
      { user: users.employee!.id, type: 'SYSTEM', title: '1', message: 'm', severity: 'INFO' },
      { user: users.employee!.id, type: 'SYSTEM', title: '2', message: 'm', severity: 'INFO' },
      { user: users.admin!.id, type: 'SYSTEM', title: '3', message: 'm', severity: 'INFO' },
    ])
    const res = await request(app).patch('/api/notifications/read-all').set(auth('employee'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'All notifications marked as read')
    assert.deepEqual(res.body.data, { modifiedCount: 2 })
    assert.equal(await Notification.countDocuments({ user: users.admin!.id, isRead: false }), 1)
  })

  it('restricts alert checks to ADMIN and PHARMACIST', async () => {
    const employee = await request(app).post('/api/alerts/check').set(auth('employee'))
    assert.equal(employee.status, 403)
    const pharmacist = await request(app).post('/api/alerts/check').set(auth('pharmacist'))
    assert.equal(pharmacist.status, 200)
    const admin = await request(app).post('/api/alerts/check').set(auth('admin'))
    assert.equal(admin.status, 200)
    assert.equal(admin.body.message, 'Stock checks completed successfully')
    assert.deepEqual(Object.keys(admin.body.data).sort(), [
      'checkedAt',
      'expirationAlerts',
      'lowStockAlerts',
      'lowStockResolved',
      'notificationsCreated',
      'recipientCount',
      'warningDays',
    ])
  })

  it('creates notifications from Inventory alerts for active ADMIN/PHARMACIST only', async () => {
    inventory.expiration = [expiredItem()]
    inventory.lowStock = [lowStockItem()]

    const res = await request(app).post('/api/alerts/check').set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.data.warningDays, 30)
    assert.equal(inventory.lastWarningDays, '30')
    assert.equal(res.body.data.expirationAlerts, 1)
    assert.equal(res.body.data.lowStockAlerts, 1)
    assert.equal(res.body.data.recipientCount, 2)
    assert.equal(res.body.data.notificationsCreated, 4)

    assert.equal(await Notification.countDocuments({ user: users.employee!.id }), 0)
    assert.equal(await Notification.countDocuments({ user: users.inactiveAdmin!.id }), 0)

    const expired = await Notification.findOne({
      user: users.admin!.id,
      type: 'EXPIRED_MEDICINE',
    }).lean()
    assert.equal(expired?.title, 'Expired: Amoxicillin')
    assert.equal(expired?.severity, 'CRITICAL')
    assert.equal(
      expired?.message,
      'Batch AMX-01 of Amoxicillin expired on 2020-01-15. Quantity remaining: 4.',
    )
    assert.equal(String(expired?.relatedBatch), batchA)

    const low = await Notification.findOne({ user: users.pharmacist!.id, type: 'LOW_STOCK' }).lean()
    assert.equal(low?.title, 'Low stock: Paracetamol')
    assert.equal(
      low?.message,
      'Paracetamol is below minimum stock. Current: 3 box, minimum: 20 box.',
    )
    assert.equal(low?.relatedBatch, null)
  })

  it('formats expiration warnings exactly like the monolith', async () => {
    inventory.expiration = [
      {
        ...expiredItem(),
        status: 'WARNING',
        expirationDate: '2030-03-04T00:00:00.000Z',
        daysUntilExpiration: 12,
      },
    ]
    await runStockChecks()
    const warning = await Notification.findOne({ user: users.admin!.id }).lean()
    assert.equal(warning?.type, 'EXPIRATION_WARNING')
    assert.equal(warning?.severity, 'WARNING')
    assert.equal(warning?.title, 'Expiring soon: Amoxicillin')
    assert.equal(
      warning?.message,
      'Batch AMX-01 of Amoxicillin expires on 2030-03-04 (12 day(s) left). Quantity: 4.',
    )
  })

  it('deduplicates unread notifications across repeated checks', async () => {
    inventory.expiration = [expiredItem()]
    inventory.lowStock = [lowStockItem()]

    const first = await runStockChecks()
    assert.equal(first.notificationsCreated, 4)
    const second = await runStockChecks()
    assert.equal(second.notificationsCreated, 0)
    assert.equal(await Notification.countDocuments({}), 4)

    // Existing behavior: once read, the same still-active alert is notified again.
    const adminExpired = await Notification.findOne({
      user: users.admin!.id,
      type: 'EXPIRED_MEDICINE',
    })
    await request(app).patch(`/api/notifications/${adminExpired!._id}/read`).set(auth('admin'))
    const third = await runStockChecks()
    assert.equal(third.notificationsCreated, 1)
    assert.equal(
      await Notification.countDocuments({ user: users.admin!.id, type: 'EXPIRED_MEDICINE' }),
      2,
    )

    // A genuinely new alert creates new notifications.
    const medC = oid()
    inventory.lowStock = [lowStockItem(), lowStockItem(medC, 'Ibuprofen')]
    const fourth = await runStockChecks()
    assert.equal(fourth.notificationsCreated, 2)
  })

  it('does not duplicate under concurrent checks', async () => {
    inventory.lowStock = [lowStockItem()]
    const results = await Promise.all([runStockChecks(), runStockChecks(), runStockChecks()])
    assert.equal(results.reduce((sum, r) => sum + r.notificationsCreated, 0), 2)
    assert.equal(await Notification.countDocuments({ type: 'LOW_STOCK' }), 2)
  })

  it('resolves unread low-stock notifications when Inventory no longer reports them', async () => {
    inventory.lowStock = [lowStockItem()]
    await runStockChecks()
    assert.equal(await Notification.countDocuments({ type: 'LOW_STOCK', isRead: false }), 2)

    inventory.lowStock = []
    const summary = await runStockChecks()
    assert.equal(summary.lowStockResolved, 2)
    assert.equal(await Notification.countDocuments({ type: 'LOW_STOCK', isRead: false }), 0)
  })

  it('returns 503 and creates nothing when Inventory is unavailable', async () => {
    inventory.expiration = [expiredItem()]
    inventory.down = true
    const res = await request(app).post('/api/alerts/check').set(auth('admin'))
    assert.equal(res.status, 503)
    assert.equal(res.body.success, false)
    assert.equal(res.body.message, 'Inventory Service unavailable')
    assert.equal(await Notification.countDocuments({}), 0)

    process.env.INVENTORY_SERVICE_URL = 'http://127.0.0.1:1'
    try {
      const unreachable = await request(app).post('/api/alerts/check').set(auth('admin'))
      assert.equal(unreachable.status, 503)
    } finally {
      process.env.INVENTORY_SERVICE_URL = inventoryUrl
    }
    assert.equal(await Notification.countDocuments({}), 0)
  })

  it('sends the internal token to Inventory when configured', async () => {
    process.env.INTERNAL_API_TOKEN = 'shared-secret'
    await runStockChecks()
    assert.equal(inventory.lastToken, 'shared-secret')
  })

  it('authenticates through Auth Service introspection', async () => {
    process.env.AUTH_SERVICE_URL = authUrl
    const ok = await request(app).get('/api/notifications/unread-count').set(auth('employee'))
    assert.equal(ok.status, 200)
    const inactive = await request(app)
      .get('/api/notifications/unread-count')
      .set(auth('inactiveAdmin'))
    assert.equal(inactive.status, 401)
    const forged = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer forged')
    assert.equal(forged.status, 401)
    const check = await request(app).post('/api/alerts/check').set(auth('employee'))
    assert.equal(check.status, 403)
  })

  it('does not serve Inventory-owned alert reads', async () => {
    const res = await request(app).get('/api/alerts').set(auth('admin'))
    assert.equal(res.status, 404)
  })

  it('does not start the scheduler in test mode or when disabled', () => {
    stopStockCheckScheduler()
    startStockCheckScheduler({ ...loadEnv(), NODE_ENV: 'test', STOCK_CHECK_ENABLED: true })
    assert.equal(isStockCheckSchedulerStarted(), false)
    startStockCheckScheduler({ ...loadEnv(), NODE_ENV: 'development', STOCK_CHECK_ENABLED: false })
    assert.equal(isStockCheckSchedulerStarted(), false)
    startStockCheckScheduler({ ...loadEnv(), NODE_ENV: 'development', STOCK_CHECK_ENABLED: true })
    assert.equal(isStockCheckSchedulerStarted(), true)
    stopStockCheckScheduler()
  })
})
