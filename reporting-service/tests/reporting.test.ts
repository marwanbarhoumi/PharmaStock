import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import type { Express } from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { READ_ONLY_CONNECT_OPTIONS } from '../src/config/database.js'
import { loadEnv } from '../src/config/env.js'
import { Batch, ReadOnlyViolationError, Sale, User } from '../src/models/index.js'
import type { UserRole } from '../src/types/enums.js'
import { resolveDateRange } from '../src/utils/date-range.js'
import { signAccessToken } from '../src/utils/jwt.js'

const JWT_SECRET = 'test_jwt_secret_key_123'
const DAY = 24 * 60 * 60 * 1000
const COLLECTIONS = [
  'users',
  'categories',
  'suppliers',
  'medicines',
  'batches',
  'stock_movements',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'notifications',
  'audit_logs',
]

const oid = () => new mongoose.Types.ObjectId()
const today = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
const daysFromToday = (days: number, hours = 12) =>
  new Date(today().getTime() + days * DAY + hours * 60 * 60 * 1000)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const assertClose = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`)

const DASHBOARD_PATHS = ['/api/dashboard/summary', '/api/dashboard/charts', '/api/dashboard/recent']
const REPORT_PATHS = [
  '/api/reports/sales',
  '/api/reports/purchases',
  '/api/reports/stock',
  '/api/reports/low-stock',
  '/api/reports/expiration',
  '/api/reports/profit',
  '/api/reports/export?type=sales',
]

describe('Reporting Service', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let authServer: Server
  let seeded = false
  const tokens: Record<string, string> = {}
  const introspection = new Map<string, { id: string; email: string; role: UserRole; isActive: boolean }>()

  const ids = {
    admin: oid(),
    pharmacist: oid(),
    employee: oid(),
    inactive: oid(),
    category: oid(),
    supplierA: oid(),
    supplierB: oid(),
    medA: oid(),
    medB: oid(),
    medInactive: oid(),
    medEmpty: oid(),
    batchA1: oid(),
    batchA2: oid(),
    batchA3: oid(),
    batchA4: oid(),
    batchB1: oid(),
    batchB2: oid(),
    sale1: oid(),
    sale2: oid(),
    saleCancelled: oid(),
    saleOld: oid(),
    purchase1: oid(),
    purchasePending: oid(),
    purchaseCancelled: oid(),
    purchaseOld: oid(),
  }

  const db = () => mongoose.connection.db!
  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` })

  async function fingerprint() {
    const result: Record<string, string> = {}
    for (const name of COLLECTIONS) {
      const docs = await db().collection(name).find({}).sort({ _id: 1 }).toArray()
      result[name] = `${docs.length}:${createHash('sha1').update(JSON.stringify(docs)).digest('hex')}`
    }
    return result
  }

  /** Simulates the owning services' data with raw driver writes (Reporting itself cannot write). */
  async function seed() {
    if (seeded) return
    seeded = true
    const base = { createdAt: daysFromToday(-90), updatedAt: daysFromToday(-90) }
    const user = (id: mongoose.Types.ObjectId, key: string, role: UserRole, isActive = true) => ({
      _id: id,
      firstName: key,
      lastName: 'User',
      email: `${key}@reporting.test`,
      password: 'secret-hash-must-never-leak',
      role,
      phone: '',
      isActive,
      ...base,
    })
    await db().collection('users').insertMany([
      user(ids.admin, 'admin', 'ADMIN'),
      user(ids.pharmacist, 'pharmacist', 'PHARMACIST'),
      user(ids.employee, 'employee', 'EMPLOYEE'),
      user(ids.inactive, 'inactive', 'ADMIN', false),
    ])
    await db().collection('categories').insertOne({ _id: ids.category, name: 'Antibiotics', ...base })
    await db().collection('suppliers').insertMany([
      { _id: ids.supplierA, name: 'Supplier, "A"', phone: '1', email: 'a@s.test', isActive: true, ...base },
      { _id: ids.supplierB, name: 'Supplier B', phone: '2', email: 'b@s.test', isActive: true, ...base },
    ])
    const medicine = (
      id: mongoose.Types.ObjectId,
      name: string,
      barcode: string,
      minimumStock: number,
      isActive = true,
    ) => ({
      _id: id,
      name,
      genericName: `${name} generic`,
      barcode,
      category: ids.category,
      purchasePrice: 2,
      sellingPrice: 5,
      minimumStock,
      unit: 'box',
      supplier: ids.supplierA,
      isActive,
      ...base,
    })
    await db().collection('medicines').insertMany([
      medicine(ids.medA, 'Amoxicillin', 'AMX-1', 30),
      medicine(ids.medB, 'Paracetamol', 'PCM-1', 5),
      medicine(ids.medInactive, 'Retired', 'OLD-1', 100, false),
      medicine(ids.medEmpty, 'Zinc', 'ZNC-1', 3),
    ])
    const batch = (
      id: mongoose.Types.ObjectId,
      med: mongoose.Types.ObjectId,
      batchNumber: string,
      quantity: number,
      expiresInDays: number,
      purchasePrice: number,
      isActive = true,
    ) => ({
      _id: id,
      medicine: med,
      batchNumber,
      quantity,
      purchasePrice,
      expirationDate: daysFromToday(expiresInDays, 0),
      receivedDate: daysFromToday(-30),
      isActive,
      ...base,
    })
    await db().collection('batches').insertMany([
      batch(ids.batchA1, ids.medA, 'A-WARN', 4, 10, 1.25),
      batch(ids.batchA2, ids.medA, 'A-EXPIRED', 3, -2, 1.5),
      batch(ids.batchA3, ids.medA, 'A-LATE', 20, 200, 1.1),
      batch(ids.batchA4, ids.medA, 'A-INACTIVE', 50, 15, 1, false),
      batch(ids.batchB1, ids.medB, 'B-OK', 8, 60, 0.333),
      batch(ids.batchB2, ids.medB, 'B-EMPTY', 0, 5, 0.5),
    ])
    const sale = (
      id: mongoose.Types.ObjectId,
      invoiceNumber: string,
      total: number,
      status: string,
      createdAt: Date,
      soldBy: mongoose.Types.ObjectId,
      customerName = '',
    ) => ({
      _id: id,
      invoiceNumber,
      customerName,
      customerPhone: '',
      items: [],
      subtotal: total,
      discount: 1,
      tax: 0.5,
      total,
      paymentMethod: 'CASH',
      status,
      soldBy,
      createdAt,
      updatedAt: createdAt,
    })
    await db().collection('sales').insertMany([
      sale(ids.sale1, 'SAL-20260101-00001', 30, 'COMPLETED', daysFromToday(-1), ids.employee, 'Jane, "JD" Doe'),
      sale(ids.sale2, 'SAL-20260101-00002', 12.5, 'COMPLETED', daysFromToday(-5), ids.admin),
      sale(ids.saleCancelled, 'SAL-20260101-00003', 99, 'CANCELLED', daysFromToday(-2), ids.admin),
      sale(ids.saleOld, 'SAL-20250101-00004', 77, 'COMPLETED', daysFromToday(-60), ids.admin),
    ])
    const saleItem = (
      saleId: mongoose.Types.ObjectId,
      med: mongoose.Types.ObjectId,
      batchId: mongoose.Types.ObjectId,
      quantity: number,
      unitPrice: number,
      createdAt: Date,
    ) => ({
      _id: oid(),
      sale: saleId,
      medicine: med,
      batch: batchId,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      createdAt,
      updatedAt: createdAt,
    })
    await db().collection('sale_items').insertMany([
      saleItem(ids.sale1, ids.medA, ids.batchA1, 4, 5, daysFromToday(-1)),
      saleItem(ids.sale1, ids.medB, ids.batchB1, 2, 5, daysFromToday(-1)),
      saleItem(ids.sale2, ids.medB, ids.batchB1, 3, 4.1666, daysFromToday(-5)),
      saleItem(ids.saleCancelled, ids.medA, ids.batchA3, 9, 11, daysFromToday(-2)),
      saleItem(ids.saleOld, ids.medA, ids.batchA3, 7, 11, daysFromToday(-60)),
    ])
    const purchase = (
      id: mongoose.Types.ObjectId,
      purchaseNumber: string,
      total: number,
      status: string,
      purchaseDate: Date,
      supplier: mongoose.Types.ObjectId,
    ) => ({
      _id: id,
      purchaseNumber,
      supplier,
      items: [],
      subtotal: total,
      discount: 0,
      tax: 0,
      total,
      status,
      purchasedBy: ids.pharmacist,
      purchaseDate,
      createdAt: purchaseDate,
      updatedAt: purchaseDate,
    })
    await db().collection('purchases').insertMany([
      purchase(ids.purchase1, 'PUR-20260101-00001', 40, 'RECEIVED', daysFromToday(-2), ids.supplierA),
      purchase(ids.purchasePending, 'PUR-20260101-00002', 15, 'PENDING', daysFromToday(-3), ids.supplierB),
      purchase(ids.purchaseCancelled, 'PUR-20260101-00003', 25, 'CANCELLED', daysFromToday(-4), ids.supplierB),
      purchase(ids.purchaseOld, 'PUR-20250101-00004', 300, 'RECEIVED', daysFromToday(-40), ids.supplierB),
    ])
    await db().collection('purchase_items').insertOne({
      _id: oid(),
      purchase: ids.purchase1,
      medicine: ids.medA,
      batch: ids.batchA3,
      quantity: 20,
      unitPrice: 2,
      totalPrice: 40,
      ...base,
    })
    const movements = Array.from({ length: 10 }, (_, index) => ({
      _id: oid(),
      medicine: index % 2 ? ids.medB : ids.medA,
      batch: index % 2 ? ids.batchB1 : ids.batchA3,
      type: index % 3 ? 'SALE' : 'PURCHASE',
      quantity: index + 1,
      previousQuantity: 100,
      newQuantity: 100 - index - 1,
      reason: `movement ${index}`,
      referenceType: 'MANUAL',
      referenceId: null,
      performedBy: ids.admin,
      createdAt: daysFromToday(-index),
      updatedAt: daysFromToday(-index),
    }))
    await db().collection('stock_movements').insertMany(movements)
    await db().collection('notifications').insertOne({ _id: oid(), title: 'n', ...base })
    await db().collection('audit_logs').insertOne({ _id: oid(), action: 'LOGIN', ...base })
  }

  before(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_EXPIRES_IN = '1h'
    process.env.CLIENT_URL = 'http://localhost:5173'
    process.env.EXPIRATION_WARNING_DAYS = '30'

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
    await new Promise<void>((resolve) => authServer.listen(0, '127.0.0.1', () => resolve()))
    process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${(authServer.address() as AddressInfo).port}`

    for (const [key, role, isActive] of [
      ['admin', 'ADMIN', true],
      ['pharmacist', 'PHARMACIST', true],
      ['employee', 'EMPLOYEE', true],
      ['inactive', 'ADMIN', false],
    ] as Array<[keyof typeof ids, UserRole, boolean]>) {
      const id = ids[key].toString()
      const email = `${key}@reporting.test`
      const token = signAccessToken({ sub: id, email, role }, JWT_SECRET, '1h')
      tokens[key] = token
      introspection.set(token, { id, email, role, isActive })
    }

    mongo = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongo.getUri('pharmastock')
    mongoose.set('bufferCommands', false)
    await mongoose.connect(process.env.MONGODB_URI, READ_ONLY_CONNECT_OPTIONS)
    app = createApp(loadEnv())
  })

  after(async () => {
    await new Promise<void>((resolve) => authServer.close(() => resolve()))
    await mongoose.disconnect()
    await mongo.stop()
  })

  it('exposes a health endpoint identifying the read-only Reporting Service', async () => {
    const res = await request(app).get('/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.service, 'reporting')
    assert.equal(res.body.mode, 'read-only')
    assert.equal(res.body.database, 'connected')
  })

  it('returns valid empty reports (not errors) and creates no collection or index on an empty database', async () => {
    const summary = await request(app).get('/api/dashboard/summary').set(auth('admin'))
    assert.equal(summary.status, 200)
    assert.deepEqual(summary.body.data.inventory, {
      totalMedicines: 0,
      totalStockQuantity: 0,
      lowStockMedicines: 0,
      expiredBatches: 0,
      expiringSoonBatches: 0,
      expirationWarningDays: 30,
    })
    assert.equal(summary.body.data.commerce.revenue, 0)
    assert.equal(summary.body.data.commerce.profit, 0)

    const charts = await request(app).get('/api/dashboard/charts').set(auth('admin'))
    assert.equal(charts.body.data.series.length, 30)
    assert.ok(charts.body.data.series.every((row: { salesTotal: number }) => row.salesTotal === 0))

    const recent = await request(app).get('/api/dashboard/recent').set(auth('admin'))
    assert.deepEqual(recent.body.data, { recentSales: [], recentMovements: [] })

    const profit = await request(app).get('/api/reports/profit').set(auth('admin'))
    assert.deepEqual(profit.body.data.summary, { revenue: 0, cost: 0, profit: 0, lines: 0 })
    assert.deepEqual(profit.body.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 })

    const csv = await request(app).get('/api/reports/export?type=stock').set(auth('admin'))
    assert.equal(csv.status, 200)
    assert.equal(
      csv.text,
      'name,barcode,totalQuantity,minimumStock,isLowStock,batchCount,nearestExpiration\n',
    )

    const collections = await db().listCollections().toArray()
    assert.deepEqual(collections, [], 'Reporting must not create collections or indexes')
  })

  it('requires authentication on every dashboard and report route', async () => {
    await seed()
    const forged = signAccessToken(
      { sub: ids.admin.toString(), email: 'admin@reporting.test', role: 'ADMIN' },
      'some_other_secret_key',
      '1h',
    )
    for (const path of [...DASHBOARD_PATHS, ...REPORT_PATHS]) {
      const missing = await request(app).get(path)
      assert.equal(missing.status, 401, `missing ${path}`)
      assert.equal(missing.body.message, 'Authentication required')
      const bad = await request(app).get(path).set('Authorization', `Bearer ${forged}`)
      assert.equal(bad.status, 401, `forged ${path}`)
      const inactive = await request(app).get(path).set(auth('inactive'))
      assert.equal(inactive.status, 401, `inactive ${path}`)
    }
  })

  it('preserves RBAC: dashboard for every role, reports and exports for ADMIN/PHARMACIST only', async () => {
    for (const path of DASHBOARD_PATHS) {
      const res = await request(app).get(path).set(auth('employee'))
      assert.equal(res.status, 200, path)
    }
    for (const path of REPORT_PATHS) {
      const res = await request(app).get(path).set(auth('employee'))
      assert.equal(res.status, 403, path)
      assert.equal(res.body.success, false)
      const pharmacist = await request(app).get(path).set(auth('pharmacist'))
      assert.equal(pharmacist.status, 200, path)
    }
  })

  it('computes the dashboard summary from inventory and commerce data', async () => {
    const res = await request(app).get('/api/dashboard/summary').set(auth('employee'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Dashboard summary retrieved successfully')
    assert.deepEqual(res.body.data.range, {
      from: dateKey(new Date(today().getTime() - 29 * DAY)),
      to: dateKey(today()),
      timezone: 'UTC',
    })
    assert.deepEqual(res.body.data.inventory, {
      totalMedicines: 3,
      totalStockQuantity: 35,
      lowStockMedicines: 2,
      expiredBatches: 1,
      expiringSoonBatches: 1,
      expirationWarningDays: 30,
    })
    const { profit, ...commerce } = res.body.data.commerce
    assert.deepEqual(commerce, {
      totalSales: 2,
      totalPurchases: 1,
      revenue: 42.5,
      purchaseSpend: 40,
      profitNote: 'Profit = completed sale line totals minus (quantity × batch purchasePrice).',
    })
    assertClose(profit, 42.4998 - (4 * 1.25 + 5 * 0.333))
  })

  it('builds the daily chart series with zero-filled days', async () => {
    const res = await request(app)
      .get(`/api/dashboard/charts?from=${dateKey(daysFromToday(-6))}&to=${dateKey(today())}`)
      .set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.data.series.length, 7)
    assert.deepEqual(res.body.data.series[0], {
      date: dateKey(daysFromToday(-6)),
      salesTotal: 0,
      salesCount: 0,
      purchasesTotal: 0,
      purchasesCount: 0,
    })
    const byDate = new Map(
      res.body.data.series.map((row: { date: string }) => [row.date, row]),
    )
    assert.deepEqual(byDate.get(dateKey(daysFromToday(-5))), {
      date: dateKey(daysFromToday(-5)),
      salesTotal: 12.5,
      salesCount: 1,
      purchasesTotal: 0,
      purchasesCount: 0,
    })
    assert.equal((byDate.get(dateKey(daysFromToday(-2))) as { purchasesTotal: number }).purchasesTotal, 40)
  })

  it('lists recent completed sales and the 8 latest movements with populated fields only', async () => {
    const res = await request(app).get('/api/dashboard/recent').set(auth('employee'))
    assert.equal(res.status, 200)
    const { recentSales, recentMovements } = res.body.data
    assert.deepEqual(
      recentSales.map((s: { invoiceNumber: string }) => s.invoiceNumber),
      ['SAL-20260101-00001', 'SAL-20260101-00002', 'SAL-20250101-00004'],
    )
    assert.deepEqual(Object.keys(recentSales[0]).sort(), [
      '_id',
      'createdAt',
      'customerName',
      'invoiceNumber',
      'paymentMethod',
      'soldBy',
      'total',
    ])
    assert.deepEqual(Object.keys(recentSales[0].soldBy).sort(), ['_id', 'firstName', 'lastName'])
    assert.equal(recentMovements.length, 8)
    assert.deepEqual(
      recentMovements.map((m: { reason: string }) => m.reason),
      Array.from({ length: 8 }, (_, i) => `movement ${i}`),
    )
    assert.deepEqual(Object.keys(recentMovements[0].medicine).sort(), ['_id', 'barcode', 'name'])
    assert.deepEqual(Object.keys(recentMovements[0].batch).sort(), ['_id', 'batchNumber'])
    assert.ok(!JSON.stringify(res.body).includes('secret-hash-must-never-leak'))
  })

  it('reports completed sales in range with summary, search and pagination', async () => {
    const res = await request(app).get('/api/reports/sales?limit=1').set(auth('pharmacist'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Sales report retrieved successfully')
    assert.deepEqual(res.body.data.summary, { count: 2, revenue: 42.5 })
    assert.equal(res.body.data.items.length, 1)
    assert.equal(res.body.data.items[0].invoiceNumber, 'SAL-20260101-00001')
    assert.deepEqual(Object.keys(res.body.data.items[0].soldBy).sort(), ['_id', 'email', 'firstName', 'lastName'])
    assert.deepEqual(res.body.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 })

    const searched = await request(app).get('/api/reports/sales?search=00002').set(auth('admin'))
    assert.deepEqual(searched.body.data.summary, { count: 1, revenue: 12.5 })

    const wide = await request(app)
      .get(`/api/reports/sales?from=${dateKey(daysFromToday(-90))}`)
      .set(auth('admin'))
    assert.deepEqual(wide.body.data.summary, { count: 3, revenue: 119.5 })
  })

  it('reports only RECEIVED purchases with supplier name and purchaser', async () => {
    const res = await request(app).get('/api/reports/purchases').set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Purchases report retrieved successfully')
    assert.deepEqual(res.body.data.summary, { count: 1, spend: 40 })
    const [item] = res.body.data.items
    assert.equal(item.purchaseNumber, 'PUR-20260101-00001')
    assert.deepEqual(item.supplier, { _id: ids.supplierA.toString(), name: 'Supplier, "A"' })
    assert.deepEqual(Object.keys(item.purchasedBy).sort(), ['_id', 'email', 'firstName', 'lastName'])

    const wide = await request(app)
      .get(`/api/reports/purchases?from=${dateKey(daysFromToday(-60))}`)
      .set(auth('admin'))
    assert.deepEqual(wide.body.data.summary, { count: 2, spend: 340 })
  })

  it('reports stock per active medicine from active batches', async () => {
    const res = await request(app).get('/api/reports/stock').set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Stock report retrieved successfully')
    assert.deepEqual(
      res.body.data.map((m: { name: string; totalQuantity: number; batchCount: number; isLowStock: boolean }) => [
        m.name,
        m.totalQuantity,
        m.batchCount,
        m.isLowStock,
      ]),
      [
        ['Amoxicillin', 27, 3, true],
        ['Paracetamol', 8, 2, false],
        ['Zinc', 0, 0, true],
      ],
    )
    assert.equal(res.body.data[0].nearestExpiration, daysFromToday(-2, 0).toISOString())
    assert.equal(res.body.data[2].nearestExpiration, undefined)
    const searched = await request(app).get('/api/reports/stock?search=pcm').set(auth('admin'))
    assert.deepEqual(searched.body.data.map((m: { name: string }) => m.name), ['Paracetamol'])
  })

  it('reports low stock ordered by deficit', async () => {
    const res = await request(app).get('/api/reports/low-stock').set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Low-stock report retrieved successfully')
    assert.deepEqual(
      res.body.data.map((m: { name: string; deficit: number; totalQuantity: number }) => [
        m.name,
        m.totalQuantity,
        m.deficit,
      ]),
      [
        ['Amoxicillin', 27, 3],
        ['Zinc', 0, 3],
      ],
    )
  })

  it('reports expired and expiring batches with the configured or requested warning window', async () => {
    const res = await request(app).get('/api/reports/expiration').set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Expiration report retrieved successfully')
    assert.equal(res.body.data.warningDays, 30)
    assert.deepEqual(
      res.body.data.items.map((b: { batchNumber: string; status: string }) => [b.batchNumber, b.status]),
      [
        ['A-EXPIRED', 'EXPIRED'],
        ['A-WARN', 'WARNING'],
      ],
    )
    assert.deepEqual(Object.keys(res.body.data.items[0].medicine).sort(), ['_id', 'barcode', 'name', 'unit'])

    const wide = await request(app).get('/api/reports/expiration?warningDays=90').set(auth('admin'))
    assert.equal(wide.body.data.warningDays, 90)
    assert.deepEqual(
      wide.body.data.items.map((b: { batchNumber: string }) => b.batchNumber),
      ['A-EXPIRED', 'A-WARN', 'B-OK'],
    )
  })

  it('reports profit per sold line using batch purchase price', async () => {
    const res = await request(app).get('/api/reports/profit').set(auth('admin'))
    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Profit report retrieved successfully')
    assert.equal(res.body.data.note, 'Profit uses batch.purchasePrice at reporting time for each sold line.')
    const cost = 4 * 1.25 + 5 * 0.333
    const summary = res.body.data.summary
    assert.deepEqual(Object.keys(summary).sort(), ['_id', 'cost', 'lines', 'profit', 'revenue'])
    assert.equal(summary._id, null)
    assert.equal(summary.lines, 3)
    assertClose(summary.revenue, 42.4998)
    assertClose(summary.cost, cost)
    assertClose(summary.profit, 42.4998 - cost)
    assert.equal(res.body.data.items.length, 3)
    assert.equal(res.body.data.items[0].invoiceNumber, 'SAL-20260101-00001')
    assert.equal(res.body.data.items[2].invoiceNumber, 'SAL-20260101-00002')
    assert.equal(res.body.data.items[2].purchasePrice, 0.333)
  })

  it('exports every CSV type with the monolith headers, escaping and filename', async () => {
    const stamp = dateKey(new Date())
    const sales = await request(app).get('/api/reports/export?type=sales').set(auth('admin'))
    assert.equal(sales.status, 200)
    assert.equal(sales.headers['content-type'], 'text/csv; charset=utf-8')
    assert.equal(sales.headers['content-disposition'], `attachment; filename="sales-report-${stamp}.csv"`)
    assert.equal(
      sales.text,
      'invoiceNumber,total,discount,tax,paymentMethod,createdAt\n' +
        `SAL-20260101-00001,30,1,0.5,CASH,${daysFromToday(-1).toISOString()}\n` +
        `SAL-20260101-00002,12.5,1,0.5,CASH,${daysFromToday(-5).toISOString()}\n`,
    )

    const expectations: Record<string, { header: string; rows: number }> = {
      purchases: { header: 'purchaseNumber,total,discount,tax,purchaseDate', rows: 1 },
      stock: {
        header: 'name,barcode,totalQuantity,minimumStock,isLowStock,batchCount,nearestExpiration',
        rows: 3,
      },
      'low-stock': { header: 'name,barcode,totalQuantity,minimumStock,deficit,unit', rows: 2 },
      expiration: { header: 'batchNumber,medicine,quantity,expirationDate,status', rows: 2 },
      profit: {
        header: 'invoiceNumber,medicineName,batchNumber,quantity,revenue,cost,profit,soldAt',
        rows: 3,
      },
    }
    for (const [type, expected] of Object.entries(expectations)) {
      const res = await request(app).get(`/api/reports/export?type=${type}`).set(auth('pharmacist'))
      assert.equal(res.status, 200, type)
      assert.equal(res.headers['content-disposition'], `attachment; filename="${type}-report-${stamp}.csv"`)
      const lines = res.text.trimEnd().split('\n')
      assert.equal(lines[0], expected.header, type)
      assert.equal(lines.length - 1, expected.rows, type)
    }
    const stock = await request(app).get('/api/reports/export?type=stock').set(auth('admin'))
    assert.equal(stock.text.split('\n')[1], `Amoxicillin,AMX-1,27,30,yes,3,${daysFromToday(-2, 0).toISOString()}`)
    const expiration = await request(app).get('/api/reports/export?type=expiration').set(auth('admin'))
    assert.equal(expiration.text.split('\n')[1], `A-EXPIRED,Amoxicillin,3,${dateKey(daysFromToday(-2, 0))},EXPIRED`)
  })

  it('rejects invalid filters and date ranges like the monolith', async () => {
    const reversed = await request(app)
      .get('/api/reports/sales?from=2026-02-10&to=2026-02-01')
      .set(auth('admin'))
    assert.equal(reversed.status, 400)
    assert.equal(reversed.body.message, 'from must be before or equal to to')
    const reversedDashboard = await request(app)
      .get('/api/dashboard/charts?from=2026-02-10&to=2026-02-01')
      .set(auth('admin'))
    assert.equal(reversedDashboard.status, 400)

    for (const path of [
      '/api/reports/sales?from=10-02-2026',
      '/api/reports/sales?limit=101',
      '/api/reports/sales?page=0',
      '/api/reports/expiration?warningDays=0',
      '/api/reports/export',
      '/api/reports/export?type=users',
      '/api/reports/export?type=sales&format=xlsx',
      '/api/dashboard/summary?to=tomorrow',
    ]) {
      const res = await request(app).get(path).set(auth('admin'))
      assert.equal(res.status, 422, path)
      assert.equal(res.body.message, 'Validation failed')
      assert.ok(Array.isArray(res.body.errors))
    }
    const unknown = await request(app).get('/api/reports/inventory').set(auth('admin'))
    assert.equal(unknown.status, 404)
  })

  it('resolves UTC date ranges without swapping from/to', () => {
    const range = resolveDateRange({ from: '2026-01-01', to: '2026-01-31' })
    assert.equal(range.from.toISOString().startsWith('2026-01-01'), true)
    assert.equal(range.to.toISOString().startsWith('2026-01-31'), true)
    assert.throws(() => resolveDateRange({ from: '2026-02-01', to: '2026-01-01' }))
  })

  it('keeps the status, content type and filename matrix for every path and role', async () => {
    const from = dateKey(daysFromToday(-60))
    const to = dateKey(today())
    const paths = [
      '/api/dashboard/summary',
      `/api/dashboard/summary?from=${from}&to=${to}`,
      '/api/dashboard/charts',
      `/api/dashboard/charts?from=${from}`,
      '/api/dashboard/recent',
      '/api/reports/sales',
      `/api/reports/sales?from=${from}&to=${to}&page=1&limit=2`,
      '/api/reports/sales?search=SAL-2026',
      '/api/reports/purchases',
      `/api/reports/purchases?from=${from}&search=pur`,
      '/api/reports/stock',
      '/api/reports/stock?search=amo&limit=1&page=1',
      '/api/reports/low-stock',
      '/api/reports/low-stock?page=2&limit=1',
      '/api/reports/expiration',
      '/api/reports/expiration?warningDays=90&search=a-',
      '/api/reports/profit',
      `/api/reports/profit?from=${from}&limit=2&page=2`,
      ...['sales', 'purchases', 'stock', 'low-stock', 'expiration', 'profit'].map(
        (type) => `/api/reports/export?type=${type}&from=${from}`,
      ),
      '/api/reports/export?type=stock&search=para',
      '/api/reports/sales?from=2026-02-10&to=2026-02-01',
      '/api/reports/sales?limit=500',
      '/api/reports/export?type=bogus',
    ]
    const statuses: Record<string, number[]> = { admin: [], employee: [] }
    for (const role of ['admin', 'employee']) {
      for (const path of paths) {
        const res = await request(app).get(path).set(auth(role))
        statuses[role]!.push(res.status)
        const exportType = /^\/api\/reports\/export\?type=([a-z-]+)/.exec(path)?.[1]
        if (res.status === 200 && exportType) {
          assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8', `${role} ${path} type`)
          assert.equal(
            res.headers['content-disposition'],
            `attachment; filename="${exportType}-report-${dateKey(today())}.csv"`,
            `${role} ${path} disposition`,
          )
          assert.ok(res.text.endsWith('\n'), `${role} ${path} trailing newline`)
        } else {
          assert.match(String(res.headers['content-type']), /^application\/json/, `${role} ${path} type`)
          assert.equal(res.headers['content-disposition'], undefined, `${role} ${path} disposition`)
          assert.equal(res.body.success, res.status === 200, `${role} ${path} success flag`)
        }
      }
    }
    assert.deepEqual(statuses.admin, [...Array(paths.length - 3).fill(200), 400, 422, 422])
    assert.deepEqual(
      statuses.employee,
      paths.map((path) => (path.startsWith('/api/dashboard') ? 200 : 403)),
    )
  })

  it('performs zero writes: data is unchanged after every endpoint and model writes are rejected', async () => {
    const before = await fingerprint()
    for (const path of [
      ...DASHBOARD_PATHS,
      ...REPORT_PATHS,
      ...['purchases', 'stock', 'low-stock', 'expiration', 'profit'].map((t) => `/api/reports/export?type=${t}`),
    ]) {
      const res = await request(app).get(path).set(auth('admin'))
      assert.equal(res.status, 200, path)
    }
    assert.deepEqual(await fingerprint(), before)

    await assert.rejects(
      Sale.create({ invoiceNumber: 'X', subtotal: 1, total: 1, soldBy: ids.admin }),
      ReadOnlyViolationError,
    )
    await assert.rejects(Batch.updateOne({ _id: ids.batchA1 }, { $set: { quantity: 999 } }), ReadOnlyViolationError)
    await assert.rejects(User.deleteMany({}), ReadOnlyViolationError)
    await assert.rejects(Sale.insertMany([{ invoiceNumber: 'Y' }]), ReadOnlyViolationError)
    await assert.rejects(Batch.findOneAndUpdate({ _id: ids.batchA1 }, { quantity: 1 }), ReadOnlyViolationError)
    const doc = await Batch.findById(ids.batchA1)
    assert.ok(doc)
    doc.quantity = 1000
    await assert.rejects(doc.save(), ReadOnlyViolationError)
    await assert.rejects(doc.deleteOne(), ReadOnlyViolationError)
    assert.deepEqual(await fingerprint(), before)
  })

  it('returns 503 (never a fake empty report) when the database is unavailable', async () => {
    await mongoose.disconnect()
    try {
      for (const path of ['/api/dashboard/summary', '/api/reports/stock', '/api/reports/export?type=sales']) {
        const res = await request(app).get(path).set(auth('admin'))
        assert.equal(res.status, 503, path)
        assert.deepEqual(res.body, {
          success: false,
          message: 'Reporting data source unavailable',
          errors: [],
        })
      }
      const health = await request(app).get('/api/health')
      assert.equal(health.body.database, 'disconnected')
    } finally {
      await mongoose.connect(process.env.MONGODB_URI!, READ_ONLY_CONNECT_OPTIONS)
    }
    const recovered = await request(app).get('/api/reports/stock').set(auth('admin'))
    assert.equal(recovered.status, 200)
  })
})
