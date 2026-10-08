import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Express } from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { AuditLog, Purchase, PurchaseItem, Supplier, User } from '../src/models/index.js'
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
  purchasePrice: number
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
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString()

describe('Purchase Service', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let inventoryServer: Server
  let medicineServer: Server
  let authServer: Server
  let inventoryUrl = ''
  let medicineUrl = ''

  /** Test double of the Inventory internal API used by purchases. */
  const inventory = {
    batches: [] as MockBatch[],
    movements: [] as MockMovement[],
    deletedBatchIds: [] as string[],
    deactivateCalls: [] as string[],
    batchCalls: 0,
    failBatchCall: 0,
    hangBatchCall: 0,
    movementCalls: 0,
    failMovementCall: 0,
    hangMovementCall: 0,
    deactivateDown: false,
    refsDown: false,
    lastRefsBody: undefined as Record<string, unknown> | undefined,
    lastToken: undefined as string | undefined,
  }

  const medicines = new Map<
    string,
    { _id: string; name: string; barcode: string; unit: string; isActive: boolean }
  >()
  let medicineDown = false

  const users: Record<string, MockUser & { token: string }> = {}
  const introspection = new Map<string, MockUser>()

  const medA = oid()
  const medB = oid()
  const medInactive = oid()
  let supplierId = ''

  function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  }

  const batchOf = (id: string) => inventory.batches.find((b) => b._id === id)

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
      const batchMatch = /^\/internal\/inventory\/batches\/([a-f0-9]{24})(\/deactivate-if-empty)?$/.exec(
        url.pathname,
      )

      if (req.method === 'POST' && url.pathname === '/internal/inventory/batches') {
        inventory.batchCalls += 1
        const call = inventory.batchCalls
        if (call === inventory.failBatchCall) {
          send(res, 503, { success: false, message: 'Injected failure' })
          return
        }
        const input = body as {
          medicineId: string
          batchNumber: string
          purchasePrice: number
          expirationDate: string
        }
        const med = medicines.get(input.medicineId)
        if (!med || !med.isActive) {
          send(res, 404, { success: false, message: 'Medicine not found' })
          return
        }
        if (
          inventory.batches.some(
            (b) => b.medicine === input.medicineId && b.batchNumber === input.batchNumber,
          )
        ) {
          send(res, 409, {
            success: false,
            message: `Batch number ${input.batchNumber} already exists for this medicine`,
          })
          return
        }
        const batch: MockBatch = {
          _id: oid(),
          medicine: input.medicineId,
          batchNumber: input.batchNumber,
          expirationDate: input.expirationDate,
          purchasePrice: input.purchasePrice,
          quantity: 0,
          isActive: true,
        }
        inventory.batches.push(batch)
        if (call === inventory.hangBatchCall) {
          await sleep(800)
        }
        if (!res.writableEnded && !res.destroyed) {
          send(res, 201, {
            success: true,
            data: { id: batch._id, batchNumber: batch.batchNumber, quantity: 0 },
          })
        }
        return
      }

      if (req.method === 'DELETE' && batchMatch && !batchMatch[2]) {
        const id = batchMatch[1]!
        inventory.deletedBatchIds.push(id)
        inventory.batches = inventory.batches.filter((b) => b._id !== id)
        send(res, 200, { success: true, data: { id, deleted: true } })
        return
      }

      if (req.method === 'POST' && batchMatch && batchMatch[2]) {
        const id = batchMatch[1]!
        inventory.deactivateCalls.push(id)
        if (inventory.deactivateDown) {
          send(res, 500, { success: false })
          return
        }
        const batch = batchOf(id)
        if (batch && batch.quantity === 0) {
          batch.isActive = false
        }
        send(res, 200, { success: true, data: { id, deactivated: Boolean(batch && !batch.isActive) } })
        return
      }

      if (req.method === 'POST' && url.pathname === '/internal/inventory/movements') {
        inventory.movementCalls += 1
        const call = inventory.movementCalls
        if (call === inventory.failMovementCall) {
          send(res, 503, { success: false, message: 'Injected failure' })
          return
        }
        const movement = body as unknown as MockMovement
        const batch = batchOf(movement.batchId)
        if (!batch) {
          send(res, 404, { success: false, message: 'Batch not found' })
          return
        }
        batch.quantity += movement.quantity
        inventory.movements.push(movement)
        if (call === inventory.hangMovementCall) {
          await sleep(800)
        }
        if (!res.writableEnded && !res.destroyed) {
          send(res, 201, { success: true, data: { batch: { id: batch._id, quantity: batch.quantity } } })
        }
        return
      }

      if (req.method === 'POST' && url.pathname === '/internal/inventory/references') {
        inventory.lastRefsBody = body
        if (inventory.refsDown) {
          send(res, 500, { success: false })
          return
        }
        const ids = (body as { batchIds: string[] }).batchIds
        const withPrice = (body as { includePurchasePrice?: boolean }).includePurchasePrice
        send(res, 200, {
          success: true,
          data: {
            medicines: [],
            batches: inventory.batches
              .filter((b) => ids.includes(b._id))
              .map(({ _id, batchNumber, expirationDate, quantity, purchasePrice }) => ({
                _id,
                batchNumber,
                expirationDate,
                quantity,
                ...(withPrice ? { purchasePrice } : {}),
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
        data: { ...med, sellingPrice: 9, purchasePrice: 1, minimumStock: 5, batches: [] },
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
    process.env.AUTH_SERVICE_URL = await listen(authServer)

    mongo = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongo.getUri()
    await mongoose.connect(mongo.getUri())
    await Purchase.syncIndexes()
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
        email: `${key.toLowerCase()}@purchase.test`,
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
    Object.assign(inventory, {
      batches: [],
      movements: [],
      deletedBatchIds: [],
      deactivateCalls: [],
      batchCalls: 0,
      failBatchCall: 0,
      hangBatchCall: 0,
      movementCalls: 0,
      failMovementCall: 0,
      hangMovementCall: 0,
      deactivateDown: false,
      refsDown: false,
      lastRefsBody: undefined,
    })
    medicineDown = false
    medicines.clear()
    medicines.set(medA, { _id: medA, name: 'Amoxicillin', barcode: 'AMX-500', unit: 'box', isActive: true })
    medicines.set(medB, { _id: medB, name: 'Paracetamol', barcode: 'PCM-1', unit: 'box', isActive: true })
    medicines.set(medInactive, { _id: medInactive, name: 'Old', barcode: 'OLD', unit: 'box', isActive: false })
    await Purchase.deleteMany({})
    await PurchaseItem.deleteMany({})
    await Supplier.deleteMany({})
    await AuditLog.deleteMany({})
    const supplier = await Supplier.create({
      name: 'Main Supplier',
      phone: '0600000000',
      email: 'main@supplier.test',
      address: '1 Street',
      contactPerson: 'Sam',
    })
    supplierId = String(supplier._id)
  })

  const auth = (key: string) => ({ Authorization: `Bearer ${users[key]!.token}` })

  function line(medicineId: string, batchNumber: string, quantity = 5, unitPrice = 2) {
    return { medicineId, batchNumber, quantity, unitPrice, expirationDate: future(180) }
  }

  function createPurchase(key: string, body: Record<string, unknown>) {
    return request(app).post('/api/purchases').set(auth(key)).send({ supplierId, ...body })
  }

  it('exposes health and requires authentication on every purchase and supplier route', async () => {
    const health = await request(app).get('/api/health')
    assert.equal(health.status, 200)
    assert.equal(health.body.service, 'purchase')

    const id = oid()
    for (const [method, path] of [
      ['get', '/api/purchases'],
      ['post', '/api/purchases'],
      ['get', `/api/purchases/${id}`],
      ['post', `/api/purchases/${id}/receive`],
      ['post', `/api/purchases/${id}/cancel`],
      ['get', '/api/suppliers'],
      ['post', '/api/suppliers'],
      ['get', `/api/suppliers/${id}`],
      ['put', `/api/suppliers/${id}`],
      ['delete', `/api/suppliers/${id}`],
    ] as const) {
      const res = await request(app)[method](path)
      assert.equal(res.status, 401, `${method} ${path}`)
    }
  })

  it('supports supplier CRUD with soft delete and the monolith messages', async () => {
    const created = await request(app)
      .post('/api/suppliers')
      .set(auth('pharmacist'))
      .send({ name: 'Beta Pharma', email: 'beta@x.test', contactPerson: 'Lina' })
    assert.equal(created.status, 201)
    assert.equal(created.body.message, 'Supplier created successfully')
    assert.equal(created.body.data.isActive, true)
    const id = created.body.data._id

    const got = await request(app).get(`/api/suppliers/${id}`).set(auth('employee'))
    assert.equal(got.status, 200)
    assert.equal(got.body.message, 'Supplier retrieved successfully')
    assert.equal(got.body.data.name, 'Beta Pharma')

    const list = await request(app).get('/api/suppliers?search=lina').set(auth('employee'))
    assert.equal(list.status, 200)
    assert.equal(list.body.message, 'Suppliers retrieved successfully')
    assert.deepEqual(list.body.data.map((s: { name: string }) => s.name), ['Beta Pharma'])

    const updated = await request(app)
      .put(`/api/suppliers/${id}`)
      .set(auth('admin'))
      .send({ phone: '0711' })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.message, 'Supplier updated successfully')
    assert.equal(updated.body.data.phone, '0711')
    assert.equal(updated.body.data.name, 'Beta Pharma')

    const removed = await request(app).delete(`/api/suppliers/${id}`).set(auth('admin'))
    assert.equal(removed.status, 200)
    assert.equal(removed.body.message, 'Supplier deactivated successfully')
    assert.equal(removed.body.data.isActive, false)
    assert.ok(await Supplier.exists({ _id: id }), 'soft delete keeps the document')

    const active = await request(app).get('/api/suppliers').set(auth('admin'))
    assert.deepEqual(active.body.data.map((s: { name: string }) => s.name), ['Main Supplier'])
    const inactive = await request(app).get('/api/suppliers?isActive=false').set(auth('admin'))
    assert.deepEqual(inactive.body.data.map((s: { name: string }) => s.name), ['Beta Pharma'])

    for (const [method, path] of [
      ['get', `/api/suppliers/${oid()}`],
      ['put', `/api/suppliers/${oid()}`],
      ['delete', `/api/suppliers/${oid()}`],
    ] as const) {
      const res = await request(app)[method](path).set(auth('admin')).send({ name: 'X' })
      assert.equal(res.status, 404, `${method} ${path}`)
      assert.equal(res.body.message, 'Supplier not found')
    }
  })

  it('validates supplier input and enforces supplier RBAC', async () => {
    for (const body of [{}, { name: '' }, { name: 'X', email: 'not-an-email' }]) {
      const res = await request(app).post('/api/suppliers').set(auth('admin')).send(body)
      assert.equal(res.status, 422, JSON.stringify(body))
      assert.ok(Array.isArray(res.body.errors))
    }
    const bad = await request(app).get('/api/suppliers/not-an-id').set(auth('admin'))
    assert.equal(bad.status, 422)

    const list = await request(app).get('/api/suppliers').set(auth('employee'))
    assert.equal(list.status, 200)
    for (const [method, path] of [
      ['post', '/api/suppliers'],
      ['put', `/api/suppliers/${supplierId}`],
      ['delete', `/api/suppliers/${supplierId}`],
    ] as const) {
      const res = await request(app)[method](path).set(auth('employee')).send({ name: 'X' })
      assert.equal(res.status, 403, `${method} ${path}`)
    }
    assert.equal((await Supplier.findById(supplierId).lean())?.isActive, true)
  })

  it('creates a PENDING purchase with zero-quantity batches, exact totals, detail shape and audit', async () => {
    const res = await createPurchase('pharmacist', {
      discount: 3,
      tax: 1,
      items: [line(medA, 'A-1', 5, 2), line(medB, 'B-1', 2, 4.5)],
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.message, 'Purchase created successfully')
    const purchase = res.body.data
    assert.match(purchase.purchaseNumber, /^PUR-\d{8}-\d{5}$/)
    assert.equal(purchase.status, 'PENDING')
    assert.equal(purchase.subtotal, 19)
    assert.equal(purchase.total, 17)
    assert.deepEqual(Object.keys(purchase.supplier).sort(), [
      '_id',
      'address',
      'contactPerson',
      'email',
      'name',
      'phone',
    ])
    assert.equal(purchase.purchasedBy.email, 'pharmacist@purchase.test')
    assert.equal(purchase.purchasedBy.role, 'PHARMACIST')
    assert.equal(purchase.purchasedBy.password, undefined)
    assert.equal(purchase.items.length, 2)
    assert.deepEqual(purchase.items[0].medicine, {
      _id: medA,
      name: 'Amoxicillin',
      barcode: 'AMX-500',
      unit: 'box',
    })
    assert.deepEqual(Object.keys(purchase.items[0].batch).sort(), [
      '_id',
      'batchNumber',
      'expirationDate',
      'purchasePrice',
      'quantity',
    ])
    assert.equal(purchase.items[0].batch.quantity, 0)
    assert.equal(purchase.items[0].batch.purchasePrice, 2)
    assert.equal(purchase.items[1].totalPrice, 9)

    assert.equal(inventory.batches.length, 2)
    assert.ok(inventory.batches.every((b) => b.quantity === 0 && b.isActive))
    assert.equal(inventory.movements.length, 0)
    assert.equal(await PurchaseItem.countDocuments({ purchase: purchase._id }), 2)

    await sleep(50)
    const audit = await AuditLog.findOne({ action: 'CREATE_PURCHASE' }).lean()
    assert.equal(String(audit?.entityId), purchase._id)
    assert.equal(audit?.description, `Purchase ${purchase.purchaseNumber} created`)
  })

  it('creates a RECEIVED purchase with receiveNow and records PURCHASE movements', async () => {
    const res = await createPurchase('admin', {
      receiveNow: true,
      items: [line(medA, 'A-1', 7, 1), line(medB, 'B-1', 3, 1)],
    })
    assert.equal(res.status, 201)
    const purchase = res.body.data
    assert.equal(purchase.status, 'RECEIVED')
    assert.deepEqual(
      inventory.batches.map((b) => b.quantity),
      [7, 3],
    )
    assert.equal(inventory.movements.length, 2)
    assert.deepEqual(inventory.movements[0], {
      medicineId: medA,
      batchId: inventory.batches[0]!._id,
      quantity: 7,
      reason: `Purchase ${purchase.purchaseNumber}`,
      referenceId: purchase._id,
      performedBy: users.admin!.id,
      type: 'PURCHASE',
      referenceType: 'PURCHASE',
    })
    const again = await request(app).post(`/api/purchases/${purchase._id}/receive`).set(auth('admin'))
    assert.equal(again.status, 409)
    assert.equal(again.body.message, 'Purchase is already received')
    assert.equal(inventory.movements.length, 2)
  })

  it('receives a pending purchase exactly once', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1', 6), line(medB, 'B-1', 4)] })
    const id = created.body.data._id

    const res = await request(app).post(`/api/purchases/${id}/receive`).set(auth('pharmacist'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Purchase received successfully')
    assert.equal(res.body.data.status, 'RECEIVED')
    assert.deepEqual(
      inventory.batches.map((b) => b.quantity),
      [6, 4],
    )
    assert.ok(
      inventory.movements.every(
        (m) =>
          m.type === 'PURCHASE' &&
          m.referenceType === 'PURCHASE' &&
          m.referenceId === id &&
          m.reason === `Receive purchase ${created.body.data.purchaseNumber}` &&
          m.performedBy === users.pharmacist!.id,
      ),
    )

    const again = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(again.status, 409)
    assert.equal(again.body.message, 'Purchase is already received')
    const cancelReceived = await request(app).post(`/api/purchases/${id}/cancel`).set(auth('admin'))
    assert.equal(cancelReceived.status, 409)
    assert.equal(cancelReceived.body.message, 'Received purchases cannot be cancelled')
    assert.equal(inventory.movements.length, 2)

    const missing = await request(app).post(`/api/purchases/${oid()}/receive`).set(auth('admin'))
    assert.equal(missing.status, 404)
    assert.equal(missing.body.message, 'Purchase not found')

    await sleep(50)
    assert.equal(await AuditLog.countDocuments(), 1, 'only CREATE_PURCHASE is audited')
  })

  it('lets only one of several concurrent receives add stock', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1', 5)] })
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(`/api/purchases/${created.body.data._id}/receive`).set(auth('admin')),
      ),
    )
    assert.equal(results.filter((r) => r.status === 200).length, 1)
    assert.equal(results.filter((r) => r.status === 409).length, 4)
    assert.equal(inventory.batches[0]!.quantity, 5)
    assert.equal(inventory.movements.length, 1)
  })

  it('cancels a pending purchase once, deactivating its empty batches without touching stock', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1'), line(medB, 'B-1')] })
    const id = created.body.data._id

    const res = await request(app).post(`/api/purchases/${id}/cancel`).set(auth('pharmacist'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Purchase cancelled successfully')
    assert.equal(res.body.data.status, 'CANCELLED')
    assert.ok(inventory.batches.every((b) => !b.isActive && b.quantity === 0))
    assert.equal(inventory.movements.length, 0)

    const again = await request(app).post(`/api/purchases/${id}/cancel`).set(auth('admin'))
    assert.equal(again.status, 409)
    assert.equal(again.body.message, 'Purchase is already cancelled')
    const receive = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(receive.status, 409)
    assert.equal(receive.body.message, 'Cancelled purchases cannot be received')
    assert.equal(inventory.deactivateCalls.length, 2)
    assert.equal(inventory.movements.length, 0)

    const missing = await request(app).post(`/api/purchases/${oid()}/cancel`).set(auth('admin'))
    assert.equal(missing.status, 404)
  })

  it('lists purchases with pagination, filters, sorting and the list populate shape', async () => {
    const first = await createPurchase('pharmacist', { items: [line(medA, 'A-1', 1, 1)] })
    await createPurchase('admin', { items: [line(medB, 'B-1', 2, 1)] })
    await createPurchase('admin', { items: [line(medB, 'B-2', 3, 1)] })
    await request(app).post(`/api/purchases/${first.body.data._id}/cancel`).set(auth('admin'))

    const page = await request(app).get('/api/purchases?limit=2&page=1').set(auth('pharmacist'))
    assert.equal(page.status, 200)
    assert.equal(page.body.message, 'Purchases retrieved successfully')
    assert.equal(page.body.data.length, 2)
    assert.equal(page.body.pagination.total, 3)
    assert.equal(page.body.pagination.totalPages, 2)

    const search = await request(app)
      .get(`/api/purchases?search=${first.body.data.purchaseNumber}`)
      .set(auth('admin'))
    assert.equal(search.body.data.length, 1)
    const item = search.body.data[0]
    assert.deepEqual(Object.keys(item.supplier).sort(), ['_id', 'email', 'name', 'phone'])
    assert.deepEqual(Object.keys(item.purchasedBy).sort(), ['_id', 'email', 'firstName', 'lastName'])
    assert.deepEqual(item.items[0].medicine, { _id: medA, name: 'Amoxicillin', barcode: 'AMX-500' })
    assert.deepEqual(Object.keys(item.items[0].batch).sort(), [
      '_id',
      'batchNumber',
      'expirationDate',
      'quantity',
    ])

    const cancelled = await request(app).get('/api/purchases?status=CANCELLED').set(auth('admin'))
    assert.equal(cancelled.body.data.length, 1)
    const bySupplier = await request(app).get(`/api/purchases?supplier=${oid()}`).set(auth('admin'))
    assert.equal(bySupplier.body.data.length, 0)
    const byUser = await request(app)
      .get(`/api/purchases?purchasedBy=${users.admin!.id}&sort=total&order=asc`)
      .set(auth('admin'))
    assert.deepEqual(
      byUser.body.data.map((p: { total: number }) => p.total),
      [2, 3],
    )
    const badQuery = await request(app).get('/api/purchases?status=OPEN').set(auth('admin'))
    assert.equal(badQuery.status, 422)
  })

  it('gets a purchase by id with 404 and 422 handling', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    const res = await request(app).get(`/api/purchases/${created.body.data._id}`).set(auth('pharmacist'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Purchase retrieved successfully')
    assert.equal(res.body.data.purchaseNumber, created.body.data.purchaseNumber)

    const missing = await request(app).get(`/api/purchases/${oid()}`).set(auth('admin'))
    assert.equal(missing.status, 404)
    assert.equal(missing.body.message, 'Purchase not found')
    const bad = await request(app).get('/api/purchases/not-an-id').set(auth('admin'))
    assert.equal(bad.status, 422)
  })

  it('rejects missing or inactive suppliers before touching Inventory', async () => {
    const missing = await request(app)
      .post('/api/purchases')
      .set(auth('admin'))
      .send({ supplierId: oid(), items: [line(medA, 'A-1')] })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.message, 'Supplier not found')

    await Supplier.findByIdAndUpdate(supplierId, { $set: { isActive: false } })
    const inactive = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    assert.equal(inactive.status, 404)
    assert.equal(inactive.body.message, 'Supplier not found')
    assert.equal(inventory.batchCalls, 0)
    assert.equal(await Purchase.countDocuments(), 0)
  })

  it('validates medicines through the Medicine catalog and request bodies like the monolith', async () => {
    const unknown = await createPurchase('admin', { items: [line(medA, 'A-1'), line(oid(), 'X-1')] })
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.message, 'Medicine not found')
    const inactive = await createPurchase('admin', { items: [line(medInactive, 'O-1')] })
    assert.equal(inactive.status, 404)
    assert.equal(inactive.body.message, 'Medicine not found')
    assert.equal(inventory.batchCalls, 0, 'no batch is created before every medicine is valid')

    for (const body of [
      { items: [] },
      { items: [{ ...line(medA, 'A-1'), quantity: 0 }] },
      { items: [{ ...line(medA, 'A-1'), quantity: 1.5 }] },
      { items: [{ ...line(medA, 'A-1'), unitPrice: -1 }] },
      { items: [{ ...line(medA, ''), batchNumber: '' }] },
      { items: [{ ...line(medA, 'A-1'), expirationDate: 'not-a-date' }] },
      { items: [line('bad', 'A-1')] },
      { items: [line(medA, 'A-1')], discount: -1 },
      { items: [line(medA, 'A-1')], supplierId: 'bad' },
    ]) {
      const res = await createPurchase('admin', body)
      assert.equal(res.status, 422, JSON.stringify(body))
      assert.ok(Array.isArray(res.body.errors))
    }
    assert.equal(await Purchase.countDocuments(), 0)
  })

  it('enforces RBAC on every purchase route and Auth introspection', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    const id = created.body.data._id
    for (const [method, path] of [
      ['get', '/api/purchases'],
      ['post', '/api/purchases'],
      ['get', `/api/purchases/${id}`],
      ['post', `/api/purchases/${id}/receive`],
      ['post', `/api/purchases/${id}/cancel`],
    ] as const) {
      const res = await request(app)[method](path).set(auth('employee')).send({})
      assert.equal(res.status, 403, `${method} ${path}`)
    }
    assert.equal((await Purchase.findById(id).lean())?.status, 'PENDING')

    const inactive = await request(app).get('/api/purchases').set(auth('inactiveAdmin'))
    assert.equal(inactive.status, 401)
    const inactiveSuppliers = await request(app).get('/api/suppliers').set(auth('inactiveAdmin'))
    assert.equal(inactiveSuppliers.status, 401)

    const forged = signAccessToken(
      { sub: users.admin!.id, email: users.admin!.email, role: 'ADMIN' },
      'some_other_secret_key',
      '1h',
    )
    const forgedRes = await request(app).get('/api/purchases').set('Authorization', `Bearer ${forged}`)
    assert.equal(forgedRes.status, 401)
  })

  it('removes earlier batches when a later batch number is a duplicate (409)', async () => {
    await createPurchase('admin', { items: [line(medB, 'DUP')] })
    const before = inventory.batches.length

    const res = await createPurchase('admin', { items: [line(medA, 'NEW-1'), line(medB, 'DUP')] })
    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Batch number DUP already exists for this medicine')
    assert.equal(inventory.batches.length, before)
    assert.equal(inventory.deletedBatchIds.length, 1)
    assert.equal(await Purchase.countDocuments(), 1)
    assert.equal(await PurchaseItem.countDocuments(), 1)
  })

  it('returns 503 and creates nothing when Inventory or Medicine is unavailable', async () => {
    process.env.INVENTORY_SERVICE_URL = await closedUrl()
    const inv = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    assert.equal(inv.status, 503)
    assert.equal(inv.body.message, 'Inventory Service unavailable')

    process.env.INVENTORY_SERVICE_URL = inventoryUrl
    medicineDown = true
    const med = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    assert.equal(med.status, 503)
    assert.equal(med.body.message, 'Medicine Service unavailable')

    assert.equal(await Purchase.countDocuments(), 0)
    assert.equal(await PurchaseItem.countDocuments(), 0)
    assert.equal(inventory.batches.length, 0)
  })

  it('undoes batches and stock movements of receiveNow when a later line fails', async () => {
    inventory.failMovementCall = 2
    const res = await createPurchase('admin', {
      receiveNow: true,
      items: [line(medA, 'A-1', 4), line(medB, 'B-1', 2)],
    })
    assert.equal(res.status, 503)
    assert.equal(inventory.batches.length, 0, 'both created batches are removed')
    assert.equal(inventory.deletedBatchIds.length, 2)
    assert.equal(await Purchase.countDocuments(), 0)
    assert.equal(await PurchaseItem.countDocuments(), 0)
  })

  it('removes created batches and leaves no purchase data when persistence fails', async () => {
    const original = Purchase.prototype.save
    Purchase.prototype.save = async function () {
      throw new Error('simulated database failure')
    }
    try {
      const res = await createPurchase('admin', { items: [line(medA, 'A-1'), line(medB, 'B-1')] })
      assert.equal(res.status, 500)
      assert.equal(res.body.success, false)
    } finally {
      Purchase.prototype.save = original
    }
    assert.equal(inventory.batches.length, 0)
    assert.equal(inventory.deletedBatchIds.length, 2)
    assert.equal(await Purchase.countDocuments(), 0)
    assert.equal(await PurchaseItem.countDocuments(), 0)
  })

  it('never retries a batch creation whose outcome is unknown (timeout)', async () => {
    process.env.SERVICE_TIMEOUT_MS = '300'
    inventory.hangBatchCall = 2
    const res = await createPurchase('admin', { items: [line(medA, 'A-1'), line(medB, 'B-1')] })
    assert.equal(res.status, 503)
    assert.equal(res.body.message, 'Inventory Service unavailable')
    await sleep(900)

    assert.equal(inventory.batchCalls, 2, 'the timed-out POST is not retried')
    assert.equal(inventory.deletedBatchIds.length, 1, 'only the known batch is removed')
    assert.deepEqual(
      inventory.batches.map((b) => b.batchNumber),
      ['B-1'],
      'ambiguous batch left for reconciliation (empty, quantity 0)',
    )
    assert.equal(inventory.batches[0]!.quantity, 0)
    assert.equal(await Purchase.countDocuments(), 0)

    process.env.SERVICE_TIMEOUT_MS = '5000'
    const retry = await createPurchase('admin', { items: [line(medA, 'A-1'), line(medB, 'B-1')] })
    assert.equal(retry.status, 409, 'a client retry cannot duplicate the batch')
  })

  it('reverts the receive claim when Inventory is down before any line, then receives once later', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1', 5)] })
    const id = created.body.data._id

    process.env.INVENTORY_SERVICE_URL = await closedUrl()
    const failed = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(failed.status, 503)
    assert.equal((await Purchase.findById(id).lean())?.status, 'PENDING')

    process.env.INVENTORY_SERVICE_URL = inventoryUrl
    const ok = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(ok.status, 200)
    assert.equal(inventory.batches[0]!.quantity, 5)
    assert.equal(inventory.movements.length, 1)
  })

  it('keeps a partially received purchase RECEIVED and never adds a line twice', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1', 5), line(medB, 'B-1', 3)] })
    const id = created.body.data._id

    inventory.failMovementCall = 2
    const partial = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(partial.status, 503)
    assert.equal((await Purchase.findById(id).lean())?.status, 'RECEIVED')
    assert.deepEqual(
      inventory.batches.map((b) => b.quantity),
      [5, 0],
    )

    const retry = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(retry.status, 409)
    assert.equal(inventory.movements.length, 1)
  })

  it('keeps the purchase RECEIVED when the first line times out (outcome unknown)', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1', 5)] })
    const id = created.body.data._id

    process.env.SERVICE_TIMEOUT_MS = '300'
    inventory.hangMovementCall = 1
    const res = await request(app).post(`/api/purchases/${id}/receive`).set(auth('admin'))
    assert.equal(res.status, 503)
    await sleep(900)
    assert.equal((await Purchase.findById(id).lean())?.status, 'RECEIVED')
    assert.equal(inventory.movements.length, 1)
    assert.equal(inventory.batches[0]!.quantity, 5)
  })

  it('keeps a purchase CANCELLED when batch deactivation fails, without stock changes', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1'), line(medB, 'B-1')] })
    const id = created.body.data._id

    inventory.deactivateDown = true
    const res = await request(app).post(`/api/purchases/${id}/cancel`).set(auth('admin'))
    assert.equal(res.status, 503)
    assert.equal((await Purchase.findById(id).lean())?.status, 'CANCELLED')
    assert.equal(inventory.deactivateCalls.length, 2, 'every batch is attempted')
    assert.equal(inventory.movements.length, 0)

    const retry = await request(app).post(`/api/purchases/${id}/cancel`).set(auth('admin'))
    assert.equal(retry.status, 409)
  })

  it('returns null for references that no longer exist and placeholders when owners are down', async () => {
    const created = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    const id = created.body.data._id
    const batchId = inventory.batches[0]!._id
    assert.equal(inventory.lastRefsBody?.includePurchasePrice, true)

    inventory.refsDown = true
    medicineDown = true
    const degraded = await request(app).get(`/api/purchases/${id}`).set(auth('admin'))
    assert.equal(degraded.status, 200)
    assert.deepEqual(degraded.body.data.items[0].medicine, { _id: medA })
    assert.deepEqual(degraded.body.data.items[0].batch, { _id: batchId })

    inventory.refsDown = false
    medicineDown = false
    medicines.delete(medA)
    inventory.batches = []
    const gone = await request(app).get(`/api/purchases/${id}`).set(auth('admin'))
    assert.equal(gone.body.data.items[0].medicine, null)
    assert.equal(gone.body.data.items[0].batch, null)
  })

  it('sends the internal token to Inventory when configured', async () => {
    process.env.INTERNAL_API_TOKEN = 'secret-token'
    const res = await createPurchase('admin', { items: [line(medA, 'A-1')] })
    assert.equal(res.status, 201)
    assert.equal(inventory.lastToken, 'secret-token')
  })

  it('does not serve internal or unrelated routes', async () => {
    for (const path of [
      '/internal/inventory/batches',
      '/api/sales',
      '/api/purchasesx',
      '/api/suppliersx',
    ]) {
      const res = await request(app).get(path).set(auth('admin'))
      assert.equal(res.status, 404, path)
    }
  })
})
