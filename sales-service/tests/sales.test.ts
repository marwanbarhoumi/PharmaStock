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
import { AuditLog, Sale, SaleItem, User } from '../src/models/index.js'
import type { UserRole } from '../src/types/enums.js'
import { signAccessToken } from '../src/utils/jwt.js'

const JWT_SECRET = 'test_jwt_secret_key_123'
const DAY = 24 * 60 * 60 * 1000

interface MockUser {
  id: string
  email: string
  role: UserRole
  isActive: boolean
}

interface MockBatch {
  _id: string
  medicine: string
  batchNumber: string
  expirationDate: string
  quantity: number
  isActive: boolean
}

interface MockMovement {
  medicineId: string
  batchId: string
  type: string
  quantity: number
  reason: string
  referenceType: string
  referenceId: string
  performedBy: string
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

async function closedUrl(): Promise<string> {
  const server = createServer()
  const url = await listen(server)
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return url
}

const oid = () => new mongoose.Types.ObjectId().toString()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Sales Service', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let inventoryServer: Server
  let medicineServer: Server
  let authServer: Server
  let inventoryUrl = ''
  let medicineUrl = ''

  /** Test double of the Inventory internal API (FEFO plan + guarded movements). */
  const inventory = {
    batches: [] as MockBatch[],
    movements: [] as MockMovement[],
    movementCalls: 0,
    failMovementCall: 0,
    failMovementStatus: 503,
    hangMovementCall: 0,
    refsDown: false,
    lastToken: undefined as string | undefined,
  }

  const medicines = new Map<
    string,
    { _id: string; name: string; barcode: string; unit: string; sellingPrice: number; isActive: boolean }
  >()
  let medicineDown = false

  const users: Record<string, MockUser & { token: string }> = {}
  const introspection = new Map<string, MockUser>()

  const medA = oid()
  const medB = oid()
  const medInactive = oid()

  function send(res: import('node:http').ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  }

  function addBatch(medicine: string, batchNumber: string, days: number, quantity: number) {
    const batch: MockBatch = {
      _id: oid(),
      medicine,
      batchNumber,
      expirationDate: new Date(Date.now() + days * DAY).toISOString(),
      quantity,
      isActive: true,
    }
    inventory.batches.push(batch)
    return batch
  }

  const qty = (batch: MockBatch) => inventory.batches.find((b) => b._id === batch._id)!.quantity

  before(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_EXPIRES_IN = '1h'
    delete process.env.AUTH_SERVICE_URL
    delete process.env.INTERNAL_API_TOKEN

    inventoryServer = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
      inventory.lastToken = req.headers['x-internal-token'] as string | undefined
      const body = (await readBody(req)) as Record<string, unknown> | undefined

      if (req.method === 'POST' && url.pathname === '/internal/inventory/fefo/allocate') {
        const { medicineId, quantity } = body as { medicineId: string; quantity: number }
        const med = medicines.get(medicineId)
        if (!med || !med.isActive) {
          send(res, 404, { success: false, message: 'Medicine not found' })
          return
        }
        const today = new Date(new Date().toISOString().slice(0, 10))
        const eligible = inventory.batches
          .filter(
            (b) =>
              b.medicine === medicineId &&
              b.isActive &&
              b.quantity > 0 &&
              new Date(b.expirationDate) >= today,
          )
          .sort(
            (a, b) =>
              new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime() ||
              a._id.localeCompare(b._id),
          )
        let remaining = quantity
        const allocations = []
        for (const b of eligible) {
          if (remaining <= 0) break
          const take = Math.min(b.quantity, remaining)
          allocations.push({
            batchId: b._id,
            batchNumber: b.batchNumber,
            expirationDate: b.expirationDate,
            availableQuantity: b.quantity,
            allocatedQuantity: take,
          })
          remaining -= take
        }
        if (remaining > 0) {
          send(res, 409, {
            success: false,
            message: `Insufficient eligible stock for FEFO allocation. Missing ${remaining} unit(s).`,
          })
          return
        }
        send(res, 200, {
          success: true,
          data: { medicineId, requestedQuantity: quantity, allocatedQuantity: quantity, allocations },
        })
        return
      }

      if (req.method === 'POST' && url.pathname === '/internal/inventory/movements') {
        inventory.movementCalls += 1
        const call = inventory.movementCalls
        if (call === inventory.failMovementCall) {
          send(res, inventory.failMovementStatus, { success: false, message: 'Injected failure' })
          return
        }
        const movement = body as unknown as MockMovement
        const batch = inventory.batches.find((b) => b._id === movement.batchId)
        if (!batch) {
          send(res, 404, { success: false, message: 'Batch not found' })
          return
        }
        const delta = movement.type === 'SALE' ? -movement.quantity : movement.quantity
        if (batch.quantity + delta < 0) {
          send(res, 409, {
            success: false,
            message: 'Insufficient batch quantity for this movement',
          })
          return
        }
        const previousQuantity = batch.quantity
        batch.quantity += delta
        inventory.movements.push(movement)
        if (call === inventory.hangMovementCall) {
          await sleep(800)
        }
        if (!res.writableEnded && !res.destroyed) {
          send(res, 201, {
            success: true,
            data: {
              movement: { id: oid(), previousQuantity, newQuantity: batch.quantity },
              batch: { id: batch._id, batchNumber: batch.batchNumber, quantity: batch.quantity },
            },
          })
        }
        return
      }

      if (req.method === 'POST' && url.pathname === '/internal/inventory/references') {
        if (inventory.refsDown) {
          send(res, 500, { success: false })
          return
        }
        const ids = (body as { batchIds: string[] }).batchIds
        send(res, 200, {
          success: true,
          data: {
            medicines: [],
            batches: inventory.batches
              .filter((b) => ids.includes(b._id))
              .map(({ _id, batchNumber, expirationDate, quantity }) => ({
                _id,
                batchNumber,
                expirationDate,
                quantity,
              })),
          },
        })
        return
      }
      send(res, 404, { success: false })
    })
    inventoryUrl = await listen(inventoryServer)

    medicineServer = createServer((req, res) => {
      const match = /^\/internal\/catalog\/medicines\/([a-f0-9]{24})$/.exec(req.url ?? '')
      if (medicineDown) {
        send(res, 503, { success: false })
        return
      }
      const med = match ? medicines.get(match[1]!) : undefined
      if (!med) {
        send(res, 404, { success: false, message: 'Medicine not found' })
        return
      }
      send(res, 200, {
        success: true,
        data: { ...med, purchasePrice: 1, minimumStock: 5, batches: [] },
      })
    })
    medicineUrl = await listen(medicineServer)

    authServer = createServer((req, res) => {
      const token = (req.headers.authorization ?? '').replace('Bearer ', '')
      const user = introspection.get(token)
      if (req.url !== '/internal/auth/introspect' || !user || !user.isActive) {
        send(res, 401, { success: false })
        return
      }
      send(res, 200, {
        success: true,
        data: { active: true, user, claims: { sub: user.id, email: user.email, role: user.role } },
      })
    })
    const authUrl = await listen(authServer)
    process.env.AUTH_SERVICE_URL = authUrl

    mongo = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongo.getUri()
    await mongoose.connect(mongo.getUri())
    await Sale.syncIndexes()
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
        email: `${key.toLowerCase()}@sales.test`,
        password: 'not-used-hash',
        role,
        isActive,
      })
      const user: MockUser = { id: doc._id.toString(), email: doc.email, role, isActive }
      const token = signAccessToken({ sub: user.id, email: user.email, role }, JWT_SECRET, '1h')
      users[key] = { ...user, token }
      introspection.set(token, user)
    }
  })

  after(async () => {
    await new Promise<void>((resolve) => inventoryServer.close(() => resolve()))
    await new Promise<void>((resolve) => medicineServer.close(() => resolve()))
    await new Promise<void>((resolve) => authServer.close(() => resolve()))
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    process.env.INVENTORY_SERVICE_URL = inventoryUrl
    process.env.MEDICINE_SERVICE_URL = medicineUrl
    process.env.SERVICE_TIMEOUT_MS = '5000'
    delete process.env.INTERNAL_API_TOKEN
    inventory.batches = []
    inventory.movements = []
    inventory.movementCalls = 0
    inventory.failMovementCall = 0
    inventory.failMovementStatus = 503
    inventory.hangMovementCall = 0
    inventory.refsDown = false
    medicineDown = false
    medicines.clear()
    medicines.set(medA, {
      _id: medA,
      name: 'Amoxicillin',
      barcode: 'AMX-500',
      unit: 'box',
      sellingPrice: 10,
      isActive: true,
    })
    medicines.set(medB, {
      _id: medB,
      name: 'Paracetamol',
      barcode: 'PCM-1',
      unit: 'box',
      sellingPrice: 4,
      isActive: true,
    })
    medicines.set(medInactive, {
      _id: medInactive,
      name: 'Old',
      barcode: 'OLD',
      unit: 'box',
      sellingPrice: 1,
      isActive: false,
    })
    await Sale.deleteMany({})
    await SaleItem.deleteMany({})
    await AuditLog.deleteMany({})
  })

  const auth = (key: string) => ({ Authorization: `Bearer ${users[key]!.token}` })

  function createSale(key: string, body: Record<string, unknown>) {
    return request(app).post('/api/sales').set(auth(key)).send(body)
  }

  it('exposes health and requires authentication on every sales route', async () => {
    const health = await request(app).get('/api/health')
    assert.equal(health.status, 200)
    assert.equal(health.body.service, 'sales')

    const id = oid()
    for (const [method, path] of [
      ['get', '/api/sales'],
      ['post', '/api/sales'],
      ['get', `/api/sales/${id}`],
      ['post', `/api/sales/${id}/cancel`],
    ] as const) {
      const res = await request(app)[method](path)
      assert.equal(res.status, 401, `${method} ${path}`)
    }
  })

  it('creates a sale from one batch with exact totals, movements and populated fields', async () => {
    const batch = addBatch(medA, 'AMX-01', 60, 10)
    const res = await createSale('employee', {
      customerName: 'Jane',
      paymentMethod: 'CARD',
      discount: 5,
      tax: 2,
      items: [{ medicineId: medA, quantity: 3 }],
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.message, 'Sale created successfully')
    const sale = res.body.data
    assert.match(sale.invoiceNumber, /^SAL-\d{8}-\d{5}$/)
    assert.equal(sale.status, 'COMPLETED')
    assert.equal(sale.subtotal, 30)
    assert.equal(sale.total, 27)
    assert.equal(sale.paymentMethod, 'CARD')
    assert.equal(sale.soldBy.email, 'employee@sales.test')
    assert.equal(sale.soldBy.role, 'EMPLOYEE')
    assert.equal(sale.soldBy.password, undefined)
    assert.equal(sale.items.length, 1)
    assert.deepEqual(sale.items[0].medicine, {
      _id: medA,
      name: 'Amoxicillin',
      barcode: 'AMX-500',
      unit: 'box',
      sellingPrice: 10,
    })
    assert.deepEqual(Object.keys(sale.items[0].batch).sort(), [
      '_id',
      'batchNumber',
      'expirationDate',
      'quantity',
    ])
    assert.equal(sale.items[0].batch.quantity, 7)
    assert.equal(sale.items[0].unitPrice, 10)
    assert.equal(sale.items[0].totalPrice, 30)

    assert.equal(qty(batch), 7)
    assert.equal(inventory.movements.length, 1)
    assert.deepEqual(inventory.movements[0], {
      medicineId: medA,
      batchId: batch._id,
      type: 'SALE',
      quantity: 3,
      reason: `Sale ${sale.invoiceNumber}`,
      referenceType: 'SALE',
      referenceId: sale._id,
      performedBy: users.employee!.id,
    })

    await sleep(50)
    const audit = await AuditLog.findOne({ action: 'CREATE_SALE' }).lean()
    assert.equal(String(audit?.entityId), sale._id)
    assert.equal(audit?.description, `Sale ${sale.invoiceNumber} created`)
  })

  it('splits a sale across batches in Inventory FEFO order, skipping expired stock', async () => {
    addBatch(medA, 'EXPIRED', -3, 50)
    const late = addBatch(medA, 'LATE', 200, 10)
    const early = addBatch(medA, 'EARLY', 20, 4)

    const res = await createSale('pharmacist', { items: [{ medicineId: medA, quantity: 6 }] })
    assert.equal(res.status, 201)
    const lines = res.body.data.items as Array<{ batch: { batchNumber: string }; quantity: number }>
    assert.deepEqual(
      lines.map((l) => [l.batch.batchNumber, l.quantity]),
      [
        ['EARLY', 4],
        ['LATE', 2],
      ],
    )
    assert.equal(qty(early), 0)
    assert.equal(qty(late), 8)
    assert.equal(res.body.data.subtotal, 60)
  })

  it('rejects insufficient or expired-only stock with 409 and creates nothing', async () => {
    addBatch(medA, 'EXPIRED', -1, 100)
    addBatch(medA, 'OK', 30, 2)
    const res = await createSale('admin', { items: [{ medicineId: medA, quantity: 3 }] })
    assert.equal(res.status, 409)
    assert.equal(res.body.success, false)
    assert.equal(res.body.message, 'Insufficient eligible stock for FEFO allocation. Missing 1 unit(s).')
    assert.equal(await Sale.countDocuments(), 0)
    assert.equal(inventory.movements.length, 0)
  })

  it('validates medicines and request bodies like the monolith', async () => {
    addBatch(medA, 'A', 30, 10)
    const unknown = await createSale('admin', { items: [{ medicineId: oid(), quantity: 1 }] })
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.message, 'Medicine not found')

    const inactive = await createSale('admin', { items: [{ medicineId: medInactive, quantity: 1 }] })
    assert.equal(inactive.status, 404)
    assert.equal(inactive.body.message, 'Medicine not found')

    for (const body of [
      { items: [] },
      { items: [{ medicineId: medA, quantity: 0 }] },
      { items: [{ medicineId: medA, quantity: 1.5 }] },
      { items: [{ medicineId: 'bad', quantity: 1 }] },
      { items: [{ medicineId: medA, quantity: 1 }], paymentMethod: 'BITCOIN' },
      { items: [{ medicineId: medA, quantity: 1 }], discount: -1 },
    ]) {
      const res = await createSale('admin', body)
      assert.equal(res.status, 422, JSON.stringify(body))
      assert.equal(res.body.success, false)
      assert.ok(Array.isArray(res.body.errors))
    }
    assert.equal(await Sale.countDocuments(), 0)
    assert.equal(inventory.movements.length, 0)
  })

  it('lists sales with pagination, filters and the list populate shape for every role', async () => {
    addBatch(medA, 'A', 30, 100)
    addBatch(medB, 'B', 30, 100)
    const first = await createSale('employee', {
      customerName: 'Alice',
      items: [{ medicineId: medA, quantity: 1 }],
    })
    await createSale('admin', { customerName: 'Bob', items: [{ medicineId: medB, quantity: 2 }] })
    await createSale('admin', { customerName: 'Carol', items: [{ medicineId: medB, quantity: 1 }] })
    await request(app).post(`/api/sales/${first.body.data._id}/cancel`).set(auth('admin'))

    for (const role of ['admin', 'pharmacist', 'employee']) {
      const res = await request(app).get('/api/sales?limit=2&page=1').set(auth(role))
      assert.equal(res.status, 200)
      assert.equal(res.body.message, 'Sales retrieved successfully')
      assert.equal(res.body.data.length, 2)
      assert.equal(res.body.pagination.total, 3)
      assert.equal(res.body.pagination.totalPages, 2)
    }

    const list = await request(app).get('/api/sales?search=alice').set(auth('admin'))
    assert.equal(list.body.data.length, 1)
    const item = list.body.data[0]
    assert.deepEqual(Object.keys(item.soldBy).sort(), ['_id', 'email', 'firstName', 'lastName'])
    assert.deepEqual(item.items[0].medicine, { _id: medA, name: 'Amoxicillin', barcode: 'AMX-500' })
    assert.deepEqual(Object.keys(item.items[0].batch).sort(), ['_id', 'batchNumber', 'expirationDate'])

    const cancelled = await request(app).get('/api/sales?status=CANCELLED').set(auth('admin'))
    assert.equal(cancelled.body.data.length, 1)
    const byUser = await request(app)
      .get(`/api/sales?soldBy=${users.admin!.id}&sort=total&order=asc`)
      .set(auth('admin'))
    assert.deepEqual(
      byUser.body.data.map((s: { total: number }) => s.total),
      [4, 8],
    )
    const badQuery = await request(app).get('/api/sales?status=OPEN').set(auth('admin'))
    assert.equal(badQuery.status, 422)
  })

  it('gets a sale by id with 404 and 422 handling', async () => {
    addBatch(medA, 'A', 30, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 1 }] })
    const res = await request(app).get(`/api/sales/${created.body.data._id}`).set(auth('employee'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Sale retrieved successfully')
    assert.equal(res.body.data.invoiceNumber, created.body.data.invoiceNumber)

    const missing = await request(app).get(`/api/sales/${oid()}`).set(auth('admin'))
    assert.equal(missing.status, 404)
    assert.equal(missing.body.message, 'Sale not found')

    const bad = await request(app).get('/api/sales/not-an-id').set(auth('admin'))
    assert.equal(bad.status, 422)
  })

  it('returns null for references that no longer exist and placeholders when owners are down', async () => {
    const batch = addBatch(medA, 'A', 30, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 1 }] })
    const id = created.body.data._id

    inventory.refsDown = true
    medicineDown = true
    const degraded = await request(app).get(`/api/sales/${id}`).set(auth('admin'))
    assert.equal(degraded.status, 200)
    assert.deepEqual(degraded.body.data.items[0].medicine, { _id: medA })
    assert.deepEqual(degraded.body.data.items[0].batch, { _id: batch._id })

    inventory.refsDown = false
    medicineDown = false
    medicines.delete(medA)
    inventory.batches = []
    const gone = await request(app).get(`/api/sales/${id}`).set(auth('admin'))
    assert.equal(gone.body.data.items[0].medicine, null)
    assert.equal(gone.body.data.items[0].batch, null)
  })

  it('enforces RBAC and Auth introspection', async () => {
    addBatch(medA, 'A', 30, 10)
    const created = await createSale('employee', { items: [{ medicineId: medA, quantity: 1 }] })
    assert.equal(created.status, 201)

    const employeeCancel = await request(app)
      .post(`/api/sales/${created.body.data._id}/cancel`)
      .set(auth('employee'))
    assert.equal(employeeCancel.status, 403)

    const inactive = await request(app).get('/api/sales').set(auth('inactiveAdmin'))
    assert.equal(inactive.status, 401)
    const inactiveCreate = await createSale('inactiveAdmin', {
      items: [{ medicineId: medA, quantity: 1 }],
    })
    assert.equal(inactiveCreate.status, 401)

    const forged = signAccessToken(
      { sub: users.admin!.id, email: users.admin!.email, role: 'ADMIN' },
      'some_other_secret_key',
      '1h',
    )
    const forgedRes = await request(app).get('/api/sales').set('Authorization', `Bearer ${forged}`)
    assert.equal(forgedRes.status, 401)

    const pharmacistCancel = await request(app)
      .post(`/api/sales/${created.body.data._id}/cancel`)
      .set(auth('pharmacist'))
    assert.equal(pharmacistCancel.status, 200)
  })

  it('cancels a sale and restores the original allocations exactly once', async () => {
    const early = addBatch(medA, 'EARLY', 10, 2)
    const late = addBatch(medA, 'LATE', 90, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 5 }] })
    assert.equal(qty(early), 0)
    assert.equal(qty(late), 7)

    const res = await request(app)
      .post(`/api/sales/${created.body.data._id}/cancel`)
      .set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Sale cancelled successfully')
    assert.equal(res.body.data.status, 'CANCELLED')
    assert.equal(qty(early), 2)
    assert.equal(qty(late), 10)
    const returns = inventory.movements.filter((m) => m.type === 'RETURN_IN')
    assert.equal(returns.length, 2)
    assert.ok(returns.every((m) => m.reason === `Cancel sale ${created.body.data.invoiceNumber}`))
    assert.ok(returns.every((m) => m.referenceId === created.body.data._id))

    const again = await request(app)
      .post(`/api/sales/${created.body.data._id}/cancel`)
      .set(auth('admin'))
    assert.equal(again.status, 409)
    assert.equal(again.body.message, 'Sale is already cancelled')
    assert.equal(inventory.movements.filter((m) => m.type === 'RETURN_IN').length, 2)

    const missing = await request(app).post(`/api/sales/${oid()}/cancel`).set(auth('admin'))
    assert.equal(missing.status, 404)
    assert.equal(missing.body.message, 'Sale not found')

    await sleep(50)
    assert.equal(await AuditLog.countDocuments({ action: 'CANCEL_SALE' }), 1)
  })

  it('lets only one of several concurrent cancellations restore stock', async () => {
    const batch = addBatch(medA, 'A', 30, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 4 }] })
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(`/api/sales/${created.body.data._id}/cancel`).set(auth('admin')),
      ),
    )
    assert.equal(results.filter((r) => r.status === 200).length, 1)
    assert.equal(results.filter((r) => r.status === 409).length, 4)
    assert.equal(qty(batch), 10)
  })

  it('returns 503 and creates nothing when Inventory or Medicine is unavailable', async () => {
    addBatch(medA, 'A', 30, 10)
    process.env.INVENTORY_SERVICE_URL = await closedUrl()
    const inv = await createSale('admin', { items: [{ medicineId: medA, quantity: 1 }] })
    assert.equal(inv.status, 503)
    assert.equal(inv.body.message, 'Inventory Service unavailable')

    process.env.INVENTORY_SERVICE_URL = inventoryUrl
    medicineDown = true
    const med = await createSale('admin', { items: [{ medicineId: medA, quantity: 1 }] })
    assert.equal(med.status, 503)
    assert.equal(med.body.message, 'Medicine Service unavailable')

    assert.equal(await Sale.countDocuments(), 0)
    assert.equal(await SaleItem.countDocuments(), 0)
    assert.equal(inventory.movements.length, 0)
  })

  it('compensates applied lines when a later stock movement is rejected', async () => {
    const early = addBatch(medA, 'EARLY', 10, 2)
    const late = addBatch(medA, 'LATE', 90, 10)
    inventory.failMovementCall = 2
    inventory.failMovementStatus = 409
    const res = await createSale('admin', { items: [{ medicineId: medA, quantity: 5 }] })
    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Injected failure')
    assert.equal(qty(early), 2)
    assert.equal(qty(late), 10)
    const rollback = inventory.movements.filter((m) => m.type === 'RETURN_IN')
    assert.equal(rollback.length, 1)
    assert.match(rollback[0]!.reason, /^Rollback failed sale SAL-/)
    assert.equal(await Sale.countDocuments(), 0)
  })

  it('restores stock and leaves no sale data when persisting the sale fails', async () => {
    const batch = addBatch(medA, 'A', 30, 10)
    const original = SaleItem.insertMany.bind(SaleItem)
    ;(SaleItem as unknown as { insertMany: unknown }).insertMany = async () => {
      throw new Error('simulated database failure')
    }
    try {
      const res = await createSale('admin', { items: [{ medicineId: medA, quantity: 3 }] })
      assert.equal(res.status, 500)
      assert.equal(res.body.success, false)
    } finally {
      ;(SaleItem as unknown as { insertMany: unknown }).insertMany = original
    }
    assert.equal(qty(batch), 10)
    assert.deepEqual(
      inventory.movements.map((m) => m.type),
      ['SALE', 'RETURN_IN'],
    )
    assert.equal(await Sale.countDocuments(), 0)
    assert.equal(await SaleItem.countDocuments(), 0)
  })

  it('never retries or compensates a stock movement whose outcome is unknown (timeout)', async () => {
    const early = addBatch(medA, 'EARLY', 10, 2)
    const late = addBatch(medA, 'LATE', 90, 10)
    process.env.SERVICE_TIMEOUT_MS = '300'
    inventory.hangMovementCall = 2
    const res = await createSale('admin', { items: [{ medicineId: medA, quantity: 5 }] })
    assert.equal(res.status, 503)
    assert.equal(res.body.message, 'Inventory Service unavailable')
    await sleep(900)

    assert.equal(inventory.movementCalls, 3, 'SALE, SALE (timed out), RETURN_IN for line 1 only')
    assert.deepEqual(
      inventory.movements.map((m) => [m.type, m.batchId]),
      [
        ['SALE', early._id],
        ['SALE', late._id],
        ['RETURN_IN', early._id],
      ],
    )
    assert.equal(qty(early), 2)
    assert.equal(qty(late), 7, 'ambiguous line left for reconciliation, not double-handled')
    assert.equal(await Sale.countDocuments(), 0)
  })

  it('reverts the claim when Inventory is down before any restore, then cancels once later', async () => {
    const batch = addBatch(medA, 'A', 30, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 4 }] })
    const id = created.body.data._id

    process.env.INVENTORY_SERVICE_URL = await closedUrl()
    const failed = await request(app).post(`/api/sales/${id}/cancel`).set(auth('admin'))
    assert.equal(failed.status, 503)
    assert.equal((await Sale.findById(id).lean())?.status, 'COMPLETED')

    process.env.INVENTORY_SERVICE_URL = inventoryUrl
    const ok = await request(app).post(`/api/sales/${id}/cancel`).set(auth('admin'))
    assert.equal(ok.status, 200)
    assert.equal(qty(batch), 10)
  })

  it('keeps a partially restored sale CANCELLED and never restores a line twice', async () => {
    const early = addBatch(medA, 'EARLY', 10, 2)
    const late = addBatch(medA, 'LATE', 90, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 5 }] })
    const id = created.body.data._id

    inventory.failMovementCall = inventory.movementCalls + 2
    const partial = await request(app).post(`/api/sales/${id}/cancel`).set(auth('admin'))
    assert.equal(partial.status, 503)
    assert.equal((await Sale.findById(id).lean())?.status, 'CANCELLED')
    assert.equal(qty(early), 2)
    assert.equal(qty(late), 7)

    const retry = await request(app).post(`/api/sales/${id}/cancel`).set(auth('admin'))
    assert.equal(retry.status, 409)
    assert.equal(inventory.movements.filter((m) => m.type === 'RETURN_IN').length, 1)
  })

  it('keeps the sale CANCELLED when the first restore times out (outcome unknown)', async () => {
    addBatch(medA, 'A', 30, 10)
    const created = await createSale('admin', { items: [{ medicineId: medA, quantity: 4 }] })
    const id = created.body.data._id

    process.env.SERVICE_TIMEOUT_MS = '300'
    inventory.hangMovementCall = inventory.movementCalls + 1
    const res = await request(app).post(`/api/sales/${id}/cancel`).set(auth('admin'))
    assert.equal(res.status, 503)
    await sleep(900)
    assert.equal((await Sale.findById(id).lean())?.status, 'CANCELLED')
    assert.equal(inventory.movements.filter((m) => m.type === 'RETURN_IN').length, 1)
  })

  it('sends the internal token to Inventory when configured', async () => {
    addBatch(medA, 'A', 30, 10)
    process.env.INTERNAL_API_TOKEN = 'secret-token'
    const res = await createSale('admin', { items: [{ medicineId: medA, quantity: 1 }] })
    assert.equal(res.status, 201)
    assert.equal(inventory.lastToken, 'secret-token')
  })

  it('does not serve internal or unrelated routes', async () => {
    for (const path of ['/internal/inventory/movements', '/api/alerts', '/api/salesx']) {
      const res = await request(app).get(path).set(auth('admin'))
      assert.equal(res.status, 404, path)
    }
  })
})
