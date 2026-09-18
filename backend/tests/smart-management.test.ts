import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Express } from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'
import type { Env } from '../src/config/env.js'
import {
  Batch,
  Category,
  Medicine,
  Notification,
  User,
} from '../src/models/index.js'
import { findExpirationAlerts } from '../src/services/expiration-alert.service.js'
import { findLowStockAlerts } from '../src/services/low-stock-alert.service.js'
import {
  isStockCheckSchedulerStarted,
  startStockCheckScheduler,
  stopStockCheckScheduler,
} from '../src/services/stock-check-scheduler.js'
import { runStockChecks } from '../src/services/stock-check.service.js'
import { hashPassword } from '../src/utils/password.js'

describe('Phase 6 smart management', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let adminToken = ''
  let employeeToken = ''
  let adminUserId = ''
  let categoryId = ''
  const suffix = Date.now().toString()

  before(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'test_jwt_secret_key_123'
    process.env.JWT_EXPIRES_IN = '1h'
    process.env.CLIENT_URL = 'http://localhost:5173'
    process.env.EXPIRATION_WARNING_DAYS = '30'
    process.env.STOCK_CHECK_ENABLED = 'false'
    process.env.STOCK_CHECK_INTERVAL_MS = '3600000'

    mongo = await MongoMemoryServer.create()
    const uri = mongo.getUri()
    process.env.MONGODB_URI = uri

    await mongoose.connect(uri)

    const env: Env = {
      NODE_ENV: 'test',
      PORT: 5000,
      MONGODB_URI: uri,
      JWT_SECRET: 'test_jwt_secret_key_123',
      JWT_EXPIRES_IN: '1h',
      CLIENT_URL: 'http://localhost:5173',
      EXPIRATION_WARNING_DAYS: 30,
      STOCK_CHECK_INTERVAL_MS: 3_600_000,
      STOCK_CHECK_ENABLED: false,
    }
    app = createApp(env)

    const password = await hashPassword('Password123!')
    const admin = await User.create({
      firstName: 'Smart',
      lastName: 'Admin',
      email: `smart-admin-${suffix}@pharmastock.local`,
      password,
      role: 'ADMIN',
    })
    adminUserId = admin._id.toString()

    await User.create({
      firstName: 'Smart',
      lastName: 'Employee',
      email: `smart-employee-${suffix}@pharmastock.local`,
      password,
      role: 'EMPLOYEE',
    })

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: `smart-admin-${suffix}@pharmastock.local`,
      password: 'Password123!',
    })
    adminToken = adminLogin.body.data.accessToken as string

    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: `smart-employee-${suffix}@pharmastock.local`,
      password: 'Password123!',
    })
    employeeToken = employeeLogin.body.data.accessToken as string
  })

  after(async () => {
    stopStockCheckScheduler()
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    await Promise.all([
      Notification.deleteMany({}),
      Batch.deleteMany({}),
      Medicine.deleteMany({}),
      Category.deleteMany({}),
    ])

    const category = await Category.create({
      name: `Phase6 Cat ${suffix}`,
    })
    categoryId = category._id.toString()
  })

  it('detects expired and warning batches without mutating stock', async () => {
    const medicine = await Medicine.create({
      name: `Phase6 Exp ${suffix}`,
      category: categoryId,
      barcode: `P6-EXP-${suffix}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 0,
    })

    await Batch.create([
      {
        medicine: medicine._id,
        batchNumber: `P6-EXPIRED-${suffix}`,
        quantity: 5,
        purchasePrice: 1,
        expirationDate: new Date('2020-01-01'),
      },
      {
        medicine: medicine._id,
        batchNumber: `P6-WARN-${suffix}`,
        quantity: 3,
        purchasePrice: 1,
        expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        medicine: medicine._id,
        batchNumber: `P6-OK-${suffix}`,
        quantity: 8,
        purchasePrice: 1,
        expirationDate: new Date('2030-01-01'),
      },
    ])

    const alerts = await findExpirationAlerts(30)
    assert.equal(alerts.length, 2)
    assert.ok(alerts.some((item) => item.status === 'EXPIRED'))
    assert.ok(alerts.some((item) => item.status === 'WARNING'))

    const okBatch = await Batch.findOne({ batchNumber: `P6-OK-${suffix}` })
    assert.equal(okBatch?.quantity, 8)
  })

  it('detects low stock from batch quantities', async () => {
    const medicine = await Medicine.create({
      name: `Phase6 Low ${suffix}`,
      category: categoryId,
      barcode: `P6-LOW-${suffix}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 20,
    })

    await Batch.create({
      medicine: medicine._id,
      batchNumber: `P6-LOW-B-${suffix}`,
      quantity: 4,
      purchasePrice: 1,
      expirationDate: new Date('2029-01-01'),
    })

    const alerts = await findLowStockAlerts()
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0]?.totalQuantity, 4)
    assert.equal(alerts[0]?.minimumStock, 20)
    assert.equal(alerts[0]?.deficit, 16)
  })

  it('creates notifications once and skips duplicates on re-check', async () => {
    const medicine = await Medicine.create({
      name: `Phase6 Dup ${suffix}`,
      category: categoryId,
      barcode: `P6-DUP-${suffix}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 10,
    })

    await Batch.create({
      medicine: medicine._id,
      batchNumber: `P6-DUP-B-${suffix}`,
      quantity: 2,
      purchasePrice: 1,
      expirationDate: new Date('2020-06-01'),
    })

    const first = await runStockChecks(30)
    assert.ok(first.notificationsCreated >= 1)

    const afterFirst = await Notification.countDocuments({
      user: adminUserId,
      isRead: false,
    })
    assert.ok(afterFirst >= 1)

    const second = await runStockChecks(30)
    assert.equal(second.notificationsCreated, 0)

    const afterSecond = await Notification.countDocuments({
      user: adminUserId,
      isRead: false,
    })
    assert.equal(afterSecond, afterFirst)
  })

  it('resolves low-stock notifications when stock recovers', async () => {
    const medicine = await Medicine.create({
      name: `Phase6 Recover ${suffix}`,
      category: categoryId,
      barcode: `P6-REC-${suffix}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 10,
    })

    const batch = await Batch.create({
      medicine: medicine._id,
      batchNumber: `P6-REC-B-${suffix}`,
      quantity: 1,
      purchasePrice: 1,
      expirationDate: new Date('2029-01-01'),
    })

    await runStockChecks(30)
    const unreadBefore = await Notification.countDocuments({
      user: adminUserId,
      type: 'LOW_STOCK',
      relatedMedicine: medicine._id,
      isRead: false,
    })
    assert.equal(unreadBefore, 1)

    await Batch.findByIdAndUpdate(batch._id, { $set: { quantity: 25 } })
    const summary = await runStockChecks(30)
    assert.ok(summary.lowStockResolved >= 1)

    const unreadAfter = await Notification.countDocuments({
      user: adminUserId,
      type: 'LOW_STOCK',
      relatedMedicine: medicine._id,
      isRead: false,
    })
    assert.equal(unreadAfter, 0)
  })

  it('exposes notification APIs scoped to the authenticated user', async () => {
    await Notification.create({
      user: adminUserId,
      type: 'SYSTEM',
      title: 'Admin note',
      message: 'Only for admin',
      severity: 'INFO',
    })

    const unauthorized = await request(app).get('/api/notifications')
    assert.equal(unauthorized.status, 401)

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(list.status, 200)
    assert.equal(list.body.data.length, 1)

    const unread = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(unread.status, 200)
    assert.equal(unread.body.data.count, 1)

    const notificationId = list.body.data[0]._id as string
    const mark = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(mark.status, 200)
    assert.equal(mark.body.data.isRead, true)

    const employeeList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(employeeList.status, 200)
    assert.equal(employeeList.body.data.length, 0)
  })

  it('protects alert check and returns alert snapshots', async () => {
    const medicine = await Medicine.create({
      name: `Phase6 Alert API ${suffix}`,
      category: categoryId,
      barcode: `P6-API-${suffix}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 50,
    })

    await Batch.create({
      medicine: medicine._id,
      batchNumber: `P6-API-B-${suffix}`,
      quantity: 1,
      purchasePrice: 1,
      expirationDate: new Date('2020-01-01'),
    })

    const unauth = await request(app).get('/api/alerts')
    assert.equal(unauth.status, 401)

    const snapshot = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(snapshot.status, 200)
    assert.ok(Array.isArray(snapshot.body.data.expiration))
    assert.ok(Array.isArray(snapshot.body.data.lowStock))

    const forbidden = await request(app)
      .post('/api/alerts/check')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(forbidden.status, 403)

    const check = await request(app)
      .post('/api/alerts/check')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(check.status, 200)
    assert.ok(check.body.data.notificationsCreated >= 1)
  })

  it('looks up medicines by barcode and returns 404 when missing', async () => {
    await Medicine.create({
      name: `Phase6 Barcode ${suffix}`,
      category: categoryId,
      barcode: `P6-BC-${suffix}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 0,
    })

    const unauth = await request(app).get(`/api/medicines/barcode/P6-BC-${suffix}`)
    assert.equal(unauth.status, 401)

    const found = await request(app)
      .get(`/api/medicines/barcode/P6-BC-${suffix}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(found.status, 200)
    assert.equal(found.body.data.barcode, `P6-BC-${suffix}`)

    const missing = await request(app)
      .get('/api/medicines/barcode/DOES-NOT-EXIST')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(missing.status, 404)
  })

  it('does not start the stock-check scheduler in test mode', () => {
    stopStockCheckScheduler()
    startStockCheckScheduler({
      NODE_ENV: 'test',
      PORT: 5000,
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test',
      JWT_SECRET: 'test_jwt_secret_key_123',
      JWT_EXPIRES_IN: '1h',
      CLIENT_URL: 'http://localhost:5173',
      EXPIRATION_WARNING_DAYS: 30,
      STOCK_CHECK_INTERVAL_MS: 3_600_000,
      STOCK_CHECK_ENABLED: true,
    })
    assert.equal(isStockCheckSchedulerStarted(), false)

    startStockCheckScheduler({
      NODE_ENV: 'development',
      PORT: 5000,
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test',
      JWT_SECRET: 'test_jwt_secret_key_123',
      JWT_EXPIRES_IN: '1h',
      CLIENT_URL: 'http://localhost:5173',
      EXPIRATION_WARNING_DAYS: 30,
      STOCK_CHECK_INTERVAL_MS: 3_600_000,
      STOCK_CHECK_ENABLED: false,
    })
    assert.equal(isStockCheckSchedulerStarted(), false)
  })
})
