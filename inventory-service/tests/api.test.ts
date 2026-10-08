import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Express } from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import {
  AuditLog,
  Batch,
  Category,
  Medicine,
  StockMovement,
  User,
} from '../src/models/index.js'
import type { UserRole } from '../src/types/enums.js'
import { signAccessToken } from '../src/utils/jwt.js'

const DAY = 24 * 60 * 60 * 1000
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

describe('Inventory Service HTTP API', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let authServer: Server
  let catalogServer: Server
  let authUrl = ''
  let catalogUrl = ''
  const introspectionTokens = new Map<string, MockUser>()
  let introspectCalls = 0
  let catalogCalls = 0

  let adminToken = ''
  let pharmacistToken = ''
  let employeeToken = ''
  let inactiveToken = ''
  let adminId = ''
  let medicineId = ''

  function tokenFor(user: MockUser): string {
    return signAccessToken(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      '1h',
    )
  }

  before(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_EXPIRES_IN = '1h'
    process.env.CLIENT_URL = 'http://localhost:5173'
    process.env.EXPIRATION_WARNING_DAYS = '30'
    delete process.env.AUTH_SERVICE_URL
    delete process.env.MEDICINE_SERVICE_URL
    delete process.env.INTERNAL_API_TOKEN

    mongo = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongo.getUri()
    await mongoose.connect(mongo.getUri())
    app = createApp(loadEnv())

    const users: Array<{ role: UserRole; isActive: boolean; key: string }> = [
      { role: 'ADMIN', isActive: true, key: 'admin' },
      { role: 'PHARMACIST', isActive: true, key: 'pharmacist' },
      { role: 'EMPLOYEE', isActive: true, key: 'employee' },
      { role: 'EMPLOYEE', isActive: false, key: 'inactive' },
    ]
    const tokens: Record<string, string> = {}
    for (const entry of users) {
      const doc = await User.create({
        firstName: entry.key,
        lastName: 'User',
        email: `${entry.key}@inventory.test`,
        password: 'not-used-hash',
        role: entry.role,
        isActive: entry.isActive,
      })
      const mockUser: MockUser = {
        id: doc._id.toString(),
        email: doc.email,
        role: entry.role,
        isActive: entry.isActive,
      }
      const token = tokenFor(mockUser)
      introspectionTokens.set(token, mockUser)
      tokens[entry.key] = token
      if (entry.key === 'admin') adminId = mockUser.id
    }
    adminToken = tokens.admin ?? ''
    pharmacistToken = tokens.pharmacist ?? ''
    employeeToken = tokens.employee ?? ''
    inactiveToken = tokens.inactive ?? ''

    authServer = createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/internal/auth/introspect') {
        res.writeHead(404).end()
        return
      }
      introspectCalls += 1
      const token = (req.headers.authorization ?? '').replace('Bearer ', '')
      const user = introspectionTokens.get(token)
      res.setHeader('Content-Type', 'application/json')
      if (!user || !user.isActive) {
        res.writeHead(401).end(
          JSON.stringify({ success: false, message: 'Invalid or expired token' }),
        )
        return
      }
      res.writeHead(200).end(
        JSON.stringify({
          success: true,
          data: {
            active: true,
            user,
            claims: { sub: user.id, email: user.email, role: user.role },
          },
        }),
      )
    })
    authUrl = await listen(authServer)

    catalogServer = createServer((req, res) => {
      catalogCalls += 1
      const match = /^\/internal\/catalog\/medicines\/([^/]+)$/.exec(req.url ?? '')
      res.setHeader('Content-Type', 'application/json')
      if (!match || match[1] !== medicineId) {
        res.writeHead(404).end(
          JSON.stringify({ success: false, message: 'Medicine not found' }),
        )
        return
      }
      res.writeHead(200).end(
        JSON.stringify({ success: true, data: { _id: medicineId, isActive: true } }),
      )
    })
    catalogUrl = await listen(catalogServer)
  })

  after(async () => {
    await new Promise<void>((resolve) => authServer.close(() => resolve()))
    await new Promise<void>((resolve) => catalogServer.close(() => resolve()))
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    delete process.env.AUTH_SERVICE_URL
    delete process.env.MEDICINE_SERVICE_URL
    delete process.env.INTERNAL_API_TOKEN
    await Promise.all([
      Batch.deleteMany({}),
      StockMovement.deleteMany({}),
      Medicine.deleteMany({}),
      Category.deleteMany({}),
      AuditLog.deleteMany({}),
    ])
    const category = await Category.create({ name: 'API Category' })
    const medicine = await Medicine.create({
      name: 'API Medicine',
      barcode: 'API-BC-1',
      category: category._id,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 10,
    })
    medicineId = medicine._id.toString()
  })

  async function createBatchViaApi(
    batchNumber: string,
    quantity: number,
    expiresInDays: number,
    token = adminToken,
  ) {
    return request(app)
      .post('/api/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        medicine: medicineId,
        batchNumber,
        quantity,
        purchasePrice: 1.5,
        expirationDate: new Date(Date.now() + expiresInDays * DAY).toISOString(),
      })
  }

  it('exposes a public health endpoint identifying the service', async () => {
    const response = await request(app).get('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.service, 'inventory')
  })

  it('requires authentication on public inventory routes', async () => {
    for (const path of ['/api/batches', '/api/stock', '/api/alerts']) {
      const response = await request(app).get(path)
      assert.equal(response.status, 401, path)
    }
  })

  it('rejects inactive users in local JWT mode', async () => {
    const response = await request(app)
      .get('/api/batches')
      .set('Authorization', `Bearer ${inactiveToken}`)
    assert.equal(response.status, 401)
  })

  it('authenticates through Auth Service introspection and rejects inactive users', async () => {
    process.env.AUTH_SERVICE_URL = authUrl
    const before = introspectCalls

    const ok = await request(app)
      .get('/api/stock')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(ok.status, 200)

    const inactive = await request(app)
      .get('/api/stock')
      .set('Authorization', `Bearer ${inactiveToken}`)
    assert.equal(inactive.status, 401)

    const forged = await request(app)
      .get('/api/stock')
      .set('Authorization', 'Bearer not-a-real-token')
    assert.equal(forged.status, 401)

    assert.equal(introspectCalls - before, 3)
  })

  it('enforces RBAC on batch and stock writes', async () => {
    const employeeCreate = await createBatchViaApi('EMP', 5, 60, employeeToken)
    assert.equal(employeeCreate.status, 403)

    const pharmacistCreate = await createBatchViaApi('PHA', 5, 60, pharmacistToken)
    assert.equal(pharmacistCreate.status, 201)
    const batchId = pharmacistCreate.body.data._id as string

    const employeeMovement = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ medicineId, batchId, type: 'ADJUSTMENT_IN', quantity: 1 })
    assert.equal(employeeMovement.status, 403)

    const employeeFefo = await request(app)
      .post('/api/stock/fefo/allocate')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ medicineId, quantity: 1 })
    assert.equal(employeeFefo.status, 403)

    const employeeRead = await request(app)
      .get(`/api/batches/${batchId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(employeeRead.status, 200)

    const employeeDelete = await request(app)
      .delete(`/api/batches/${batchId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(employeeDelete.status, 403)
  })

  it('supports batch CRUD with soft delete and duplicate protection', async () => {
    const created = await createBatchViaApi('CRUD-1', 8, 90)
    assert.equal(created.status, 201)
    assert.equal(created.body.message, 'Batch created successfully')
    const batchId = created.body.data._id as string

    const duplicate = await createBatchViaApi('CRUD-1', 1, 90)
    assert.equal(duplicate.status, 409)
    assert.equal(
      duplicate.body.message,
      'This batch number already exists for the medicine',
    )

    const listed = await request(app)
      .get(`/api/batches?medicine=${medicineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(listed.status, 200)
    assert.equal(listed.body.data.length, 1)
    assert.equal(listed.body.pagination.total, 1)

    const fetched = await request(app)
      .get(`/api/batches/${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(fetched.status, 200)
    assert.equal(fetched.body.data.medicine.name, 'API Medicine')

    const updated = await request(app)
      .put(`/api/batches/${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ purchasePrice: 2.25 })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.data.purchasePrice, 2.25)

    const deleted = await request(app)
      .delete(`/api/batches/${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(deleted.status, 200)
    assert.equal(deleted.body.data.isActive, false)
    assert.ok(await Batch.findById(batchId), 'soft delete keeps the document')

    const invalid = await request(app)
      .get('/api/batches/not-an-id')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(invalid.status, 422)
  })

  it('validates medicines through the Medicine Service catalog when configured', async () => {
    process.env.MEDICINE_SERVICE_URL = catalogUrl
    const before = catalogCalls

    const ok = await createBatchViaApi('CAT-OK', 3, 60)
    assert.equal(ok.status, 201)

    const unknown = await request(app)
      .post('/api/batches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicine: new mongoose.Types.ObjectId().toString(),
        batchNumber: 'CAT-MISSING',
        quantity: 1,
        purchasePrice: 1,
        expirationDate: new Date(Date.now() + 60 * DAY).toISOString(),
      })
    assert.equal(unknown.status, 404)
    assert.equal(catalogCalls - before, 2)
  })

  it('applies stock movements, records audit logs, and lists movements', async () => {
    const created = await createBatchViaApi('MOVE-1', 5, 60)
    const batchId = created.body.data._id as string

    const movement = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicineId, batchId, type: 'ADJUSTMENT_OUT', quantity: 2, reason: 'Damaged' })
    assert.equal(movement.status, 201)
    assert.equal(movement.body.message, 'Stock movement applied successfully')
    assert.equal(movement.body.data.movement.previousQuantity, 5)
    assert.equal(movement.body.data.movement.newQuantity, 3)
    assert.equal(movement.body.data.batch.quantity, 3)

    const oversell = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicineId, batchId, type: 'ADJUSTMENT_OUT', quantity: 10 })
    assert.equal(oversell.status, 409)
    assert.equal(oversell.body.message, 'Insufficient batch quantity for this movement')

    const zero = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicineId, batchId, type: 'ADJUSTMENT_IN', quantity: 0 })
    assert.equal(zero.status, 422)

    assert.equal(await AuditLog.countDocuments({ action: 'UPDATE_STOCK' }), 1)

    const list = await request(app)
      .get(`/api/stock/movements?medicine=${medicineId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(list.status, 200)
    assert.equal(list.body.data.length, 1)
    assert.equal(list.body.data[0].type, 'ADJUSTMENT_OUT')

    const byMedicine = await request(app)
      .get(`/api/stock/${medicineId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(byMedicine.status, 200)
    assert.equal(byMedicine.body.data.totalQuantity, 3)
    assert.equal(byMedicine.body.data.isLowStock, true)

    const overview = await request(app)
      .get('/api/stock?lowStock=true')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(overview.status, 200)
    assert.ok(Array.isArray(overview.body.data))
  })

  it('returns FEFO plans and 409 on insufficient stock via the public route', async () => {
    await createBatchViaApi('F-LATE', 5, 120)
    await createBatchViaApi('F-EARLY', 2, 15)

    const plan = await request(app)
      .post('/api/stock/fefo/allocate')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ medicineId, quantity: 4 })
    assert.equal(plan.status, 200)
    assert.deepEqual(
      plan.body.data.allocations.map((a: { batchNumber: string }) => a.batchNumber),
      ['F-EARLY', 'F-LATE'],
    )

    const insufficient = await request(app)
      .post('/api/stock/fefo/allocate')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ medicineId, quantity: 50 })
    assert.equal(insufficient.status, 409)
    assert.match(insufficient.body.message, /Missing 43 unit/)
  })

  it('preserves the alert response shapes', async () => {
    await createBatchViaApi('ALERT-SOON', 3, 5)

    const all = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(all.status, 200)
    assert.equal(all.body.message, 'Alerts retrieved successfully')
    assert.equal(all.body.data.warningDays, 30)
    assert.equal(all.body.data.expiration.warningDays, 30)
    assert.equal(all.body.data.expiration.items.length, 1)
    assert.equal(all.body.data.expiration.items[0].batchNumber, 'ALERT-SOON')
    assert.equal(all.body.data.expiration.items[0].status, 'WARNING')
    assert.equal(all.body.data.lowStock.items.length, 1)
    assert.deepEqual(Object.keys(all.body.data.lowStock.items[0]).sort(), [
      'deficit',
      'medicineBarcode',
      'medicineId',
      'medicineName',
      'minimumStock',
      'totalQuantity',
      'unit',
    ])

    const expiration = await request(app)
      .get('/api/alerts/expiration')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(expiration.status, 200)
    assert.deepEqual(Object.keys(expiration.body.data).sort(), ['items', 'warningDays'])

    const lowStock = await request(app)
      .get('/api/alerts/low-stock')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(lowStock.status, 200)
    assert.deepEqual(Object.keys(lowStock.body.data), ['items'])

    const check = await request(app)
      .post('/api/alerts/check')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(check.status, 404, 'alert check belongs to the Notification Service')
  })

  it('serves the internal purchase/sale endpoints', async () => {
    const createdBatch = await request(app)
      .post('/internal/inventory/batches')
      .send({
        medicineId,
        batchNumber: 'PO-1',
        purchasePrice: 1,
        expirationDate: new Date(Date.now() + 90 * DAY).toISOString(),
      })
    assert.equal(createdBatch.status, 201)
    assert.equal(createdBatch.body.data.quantity, 0)
    const batchId = createdBatch.body.data.id as string

    const duplicate = await request(app)
      .post('/internal/inventory/batches')
      .send({
        medicineId,
        batchNumber: 'PO-1',
        purchasePrice: 1,
        expirationDate: new Date(Date.now() + 90 * DAY).toISOString(),
      })
    assert.equal(duplicate.status, 409)
    assert.equal(
      duplicate.body.message,
      'Batch number PO-1 already exists for this medicine',
    )

    const receive = await request(app)
      .post('/internal/inventory/movements')
      .send({
        medicineId,
        batchId,
        type: 'PURCHASE',
        quantity: 6,
        referenceType: 'PURCHASE',
        performedBy: adminId,
      })
    assert.equal(receive.status, 201)
    assert.equal(receive.body.data.batch.quantity, 6)

    const plan = await request(app)
      .post('/internal/inventory/fefo/allocate')
      .send({ medicineId, quantity: 4 })
    assert.equal(plan.status, 200)
    assert.equal(plan.body.data.allocations[0].batchId, batchId)

    const missingPerformer = await request(app)
      .post('/internal/inventory/movements')
      .send({ medicineId, batchId, type: 'SALE', quantity: 1 })
    assert.equal(missingPerformer.status, 422)

    const notEmpty = await request(app).post(
      `/internal/inventory/batches/${batchId}/deactivate-if-empty`,
    )
    assert.equal(notEmpty.status, 200)
    assert.equal(notEmpty.body.data.deactivated, false)

    const emptyBatch = await request(app)
      .post('/internal/inventory/batches')
      .send({
        medicineId,
        batchNumber: 'PO-2',
        purchasePrice: 1,
        expirationDate: new Date(Date.now() + 90 * DAY).toISOString(),
      })
    const emptyId = emptyBatch.body.data.id as string
    const deactivated = await request(app).post(
      `/internal/inventory/batches/${emptyId}/deactivate-if-empty`,
    )
    assert.equal(deactivated.body.data.deactivated, true)

    const removed = await request(app).delete(`/internal/inventory/batches/${emptyId}`)
    assert.equal(removed.status, 200)
    assert.equal(removed.body.data.deleted, true)
    assert.equal(await Batch.countDocuments({ _id: emptyId }), 0)
  })

  it('serves internal alert snapshots and reference lookups for notifications', async () => {
    const created = await createBatchViaApi('REF-SOON', 2, 10)
    const batchId = created.body.data._id as string

    const alerts = await request(app).get('/internal/inventory/alerts')
    assert.equal(alerts.status, 200)
    assert.equal(alerts.body.data.warningDays, 30)
    assert.equal(alerts.body.data.expiration.warningDays, 30)
    assert.equal(alerts.body.data.expiration.items[0].batchNumber, 'REF-SOON')
    assert.equal(alerts.body.data.lowStock.items[0].medicineId, medicineId)

    const narrow = await request(app).get('/internal/inventory/alerts?warningDays=5')
    assert.equal(narrow.status, 200)
    assert.equal(narrow.body.data.warningDays, 5)
    assert.equal(narrow.body.data.expiration.items.length, 0)

    const invalid = await request(app).get('/internal/inventory/alerts?warningDays=0')
    assert.equal(invalid.status, 422)

    const missingId = new mongoose.Types.ObjectId().toString()
    const refs = await request(app)
      .post('/internal/inventory/references')
      .send({ medicineIds: [medicineId, missingId], batchIds: [batchId] })
    assert.equal(refs.status, 200)
    assert.equal(refs.body.data.medicines.length, 1)
    assert.deepEqual(Object.keys(refs.body.data.medicines[0]).sort(), [
      '_id',
      'barcode',
      'name',
    ])
    assert.deepEqual(Object.keys(refs.body.data.batches[0]).sort(), [
      '_id',
      'batchNumber',
      'expirationDate',
      'quantity',
    ])

    const withPrice = await request(app)
      .post('/internal/inventory/references')
      .send({ batchIds: [batchId], includePurchasePrice: true })
    assert.equal(withPrice.status, 200)
    assert.deepEqual(Object.keys(withPrice.body.data.batches[0]).sort(), [
      '_id',
      'batchNumber',
      'expirationDate',
      'purchasePrice',
      'quantity',
    ])
  })

  it('requires the internal token on internal routes when configured', async () => {
    process.env.INTERNAL_API_TOKEN = 'internal-secret'

    const denied = await request(app)
      .post('/internal/inventory/fefo/allocate')
      .send({ medicineId, quantity: 1 })
    assert.equal(denied.status, 401)

    await createBatchViaApi('TOKEN', 3, 60)
    const allowed = await request(app)
      .post('/internal/inventory/fefo/allocate')
      .set('x-internal-token', 'internal-secret')
      .send({ medicineId, quantity: 1 })
    assert.equal(allowed.status, 200)
  })
})
