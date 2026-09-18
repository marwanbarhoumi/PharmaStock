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
  StockMovement,
  User,
} from '../src/models/index.js'
import { allocateByFefo } from '../src/services/fefo.service.js'
import { applyStockMovement } from '../src/services/stock-movement.service.js'
import { hashPassword } from '../src/utils/password.js'
import { getStockDirection } from '../src/utils/stock-direction.js'

describe('Phase 5 inventory logic', () => {
  let app: Express
  let mongo: MongoMemoryServer
  let adminToken = ''
  let adminUserId = ''
  let medicineId = ''
  let batchId = ''
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
      firstName: 'Stock',
      lastName: 'Admin',
      email: `stock-admin-${suffix}@pharmastock.local`,
      password,
      role: 'ADMIN',
    })
    adminUserId = admin._id.toString()

    await User.create({
      firstName: 'Stock',
      lastName: 'Employee',
      email: `stock-employee-${suffix}@pharmastock.local`,
      password,
      role: 'EMPLOYEE',
    })

    const login = await request(app).post('/api/auth/login').send({
      email: `stock-admin-${suffix}@pharmastock.local`,
      password: 'Password123!',
    })
    adminToken = login.body.data.accessToken as string
  })

  after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    await Promise.all([
      StockMovement.deleteMany({}),
      Batch.deleteMany({}),
      Medicine.deleteMany({}),
      Category.deleteMany({}),
    ])

    const category = await Category.create({
      name: `Phase5 Cat ${suffix}`,
    })
    const medicine = await Medicine.create({
      name: `Phase5 Med ${suffix}`,
      category: category._id,
      barcode: `P5-${suffix}-MED`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 1,
    })
    medicineId = medicine._id.toString()

    const batch = await Batch.create({
      medicine: medicine._id,
      batchNumber: `P5-${suffix}-A`,
      quantity: 10,
      purchasePrice: 1,
      expirationDate: new Date('2028-06-01'),
    })
    batchId = batch._id.toString()
  })

  it('maps movement types to the correct stock directions', () => {
    assert.equal(getStockDirection('PURCHASE'), 'IN')
    assert.equal(getStockDirection('ADJUSTMENT_IN'), 'IN')
    assert.equal(getStockDirection('RETURN_IN'), 'IN')
    assert.equal(getStockDirection('SALE'), 'OUT')
    assert.equal(getStockDirection('ADJUSTMENT_OUT'), 'OUT')
    assert.equal(getStockDirection('RETURN_OUT'), 'OUT')
  })

  it('applies inbound and outbound movements and records quantities', async () => {
    const inbound = await applyStockMovement({
      medicineId,
      batchId,
      type: 'PURCHASE',
      quantity: 5,
      reason: `Phase5 ${suffix} purchase`,
      performedBy: adminUserId,
    })

    assert.equal(inbound.movement.previousQuantity, 10)
    assert.equal(inbound.movement.newQuantity, 15)
    assert.equal(inbound.batch.quantity, 15)

    const outbound = await applyStockMovement({
      medicineId,
      batchId,
      type: 'SALE',
      quantity: 4,
      reason: `Phase5 ${suffix} sale`,
      performedBy: adminUserId,
    })

    assert.equal(outbound.movement.previousQuantity, 15)
    assert.equal(outbound.movement.newQuantity, 11)

    const batch = await Batch.findById(batchId)
    assert.equal(batch?.quantity, 11)
  })

  it('applies all remaining movement types', async () => {
    await applyStockMovement({
      medicineId,
      batchId,
      type: 'ADJUSTMENT_IN',
      quantity: 2,
      reason: `Phase5 ${suffix} adj-in`,
      performedBy: adminUserId,
    })
    await applyStockMovement({
      medicineId,
      batchId,
      type: 'RETURN_IN',
      quantity: 1,
      reason: `Phase5 ${suffix} ret-in`,
      performedBy: adminUserId,
    })
    await applyStockMovement({
      medicineId,
      batchId,
      type: 'ADJUSTMENT_OUT',
      quantity: 3,
      reason: `Phase5 ${suffix} adj-out`,
      performedBy: adminUserId,
    })
    await applyStockMovement({
      medicineId,
      batchId,
      type: 'RETURN_OUT',
      quantity: 1,
      reason: `Phase5 ${suffix} ret-out`,
      performedBy: adminUserId,
    })

    const batch = await Batch.findById(batchId)
    assert.equal(batch?.quantity, 9)
  })

  it('rejects invalid quantities and missing/mismatched batches', async () => {
    await assert.rejects(
      () =>
        applyStockMovement({
          medicineId,
          batchId,
          type: 'SALE',
          quantity: 0,
          reason: `Phase5 ${suffix} zero`,
          performedBy: adminUserId,
        }),
      /positive/i,
    )

    await assert.rejects(
      () =>
        applyStockMovement({
          medicineId,
          batchId,
          type: 'SALE',
          quantity: -2,
          reason: `Phase5 ${suffix} negative`,
          performedBy: adminUserId,
        }),
      /positive/i,
    )

    await assert.rejects(
      () =>
        applyStockMovement({
          medicineId,
          batchId: '111111111111111111111111',
          type: 'SALE',
          quantity: 1,
          reason: `Phase5 ${suffix} missing-batch`,
          performedBy: adminUserId,
        }),
      /Batch not found/i,
    )

    const otherMedicine = await Medicine.create({
      name: `Phase5 Other ${suffix}`,
      category: (await Category.findOne({ name: `Phase5 Cat ${suffix}` }))!._id,
      barcode: `P5-${suffix}-OTHER`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 0,
    })

    await assert.rejects(
      () =>
        applyStockMovement({
          medicineId: otherMedicine._id.toString(),
          batchId,
          type: 'SALE',
          quantity: 1,
          reason: `Phase5 ${suffix} mismatch`,
          performedBy: adminUserId,
        }),
      /(belong|Batch not found|Insufficient)/i,
    )

    await Batch.findByIdAndUpdate(batchId, { $set: { isActive: false } })
    await assert.rejects(
      () =>
        applyStockMovement({
          medicineId,
          batchId,
          type: 'SALE',
          quantity: 1,
          reason: `Phase5 ${suffix} inactive`,
          performedBy: adminUserId,
        }),
      /inactive/i,
    )
  })

  it('prevents negative stock and does not mutate on insufficient quantity', async () => {
    await assert.rejects(
      () =>
        applyStockMovement({
          medicineId,
          batchId,
          type: 'SALE',
          quantity: 50,
          reason: `Phase5 ${suffix} oversell`,
          performedBy: adminUserId,
        }),
      /Insufficient/i,
    )

    const batch = await Batch.findById(batchId)
    assert.equal(batch?.quantity, 10)

    const movements = await StockMovement.countDocuments({
      reason: `Phase5 ${suffix} oversell`,
    })
    assert.equal(movements, 0)
  })

  it('allocates by FEFO across batches and skips expired/empty ones', async () => {
    await Batch.create([
      {
        medicine: medicineId,
        batchNumber: `P5-${suffix}-EXPIRED`,
        quantity: 20,
        purchasePrice: 1,
        expirationDate: new Date('2020-01-01'),
      },
      {
        medicine: medicineId,
        batchNumber: `P5-${suffix}-EMPTY`,
        quantity: 0,
        purchasePrice: 1,
        expirationDate: new Date('2027-01-01'),
      },
      {
        medicine: medicineId,
        batchNumber: `P5-${suffix}-B`,
        quantity: 4,
        purchasePrice: 1,
        expirationDate: new Date('2027-01-01'),
      },
      {
        medicine: medicineId,
        batchNumber: `P5-${suffix}-C`,
        quantity: 7,
        purchasePrice: 1,
        expirationDate: new Date('2027-06-01'),
      },
    ])

    const plan = await allocateByFefo(medicineId, 9)

    assert.equal(plan.allocations.length, 2)
    assert.equal(plan.allocations[0]?.batchNumber, `P5-${suffix}-B`)
    assert.equal(plan.allocations[0]?.allocatedQuantity, 4)
    assert.equal(plan.allocations[1]?.batchNumber, `P5-${suffix}-C`)
    assert.equal(plan.allocations[1]?.allocatedQuantity, 5)

    const batchB = await Batch.findOne({ batchNumber: `P5-${suffix}-B` })
    assert.equal(batchB?.quantity, 4)
  })

  it('returns a clear error for insufficient FEFO stock without mutation', async () => {
    await assert.rejects(() => allocateByFefo(medicineId, 100), /Insufficient/i)
    const batch = await Batch.findById(batchId)
    assert.equal(batch?.quantity, 10)
  })

  it('exposes protected stock movement and FEFO endpoints', async () => {
    const unauthorized = await request(app).post('/api/stock/movements').send({
      medicineId,
      batchId,
      type: 'PURCHASE',
      quantity: 1,
    })
    assert.equal(unauthorized.status, 401)

    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: `stock-employee-${suffix}@pharmastock.local`,
      password: 'Password123!',
    })
    const employeeToken = employeeLogin.body.data.accessToken as string

    const forbidden = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        medicineId,
        batchId,
        type: 'PURCHASE',
        quantity: 1,
      })
    assert.equal(forbidden.status, 403)

    const invalidIds = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicineId: 'not-an-object-id',
        batchId: 'also-invalid',
        type: 'SALE',
        quantity: 1,
      })
    assert.equal(invalidIds.status, 422)

    const missingMedicine = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicineId: '111111111111111111111111',
        batchId,
        type: 'SALE',
        quantity: 1,
      })
    assert.equal(missingMedicine.status, 404)

    const listStock = await request(app)
      .get('/api/stock')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(listStock.status, 200)
    assert.equal(listStock.body.success, true)

    const movement = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicineId,
        batchId,
        type: 'PURCHASE',
        quantity: 2,
        reason: `Phase5 ${suffix} api-purchase`,
      })

    assert.equal(movement.status, 201)
    assert.equal(movement.body.data.movement.newQuantity, 12)

    const allocate = await request(app)
      .post('/api/stock/fefo/allocate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicineId,
        quantity: 3,
      })

    assert.equal(allocate.status, 200)
    assert.equal(allocate.body.data.allocatedQuantity, 3)

    const insufficient = await request(app)
      .post('/api/stock/fefo/allocate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicineId,
        quantity: 10_000,
      })
    assert.equal(insufficient.status, 409)
  })

  it('uses atomic outbound updates to prevent concurrent oversell', async () => {
    await Batch.findByIdAndUpdate(batchId, { $set: { quantity: 5 } })

    const results = await Promise.allSettled([
      applyStockMovement({
        medicineId,
        batchId,
        type: 'SALE',
        quantity: 4,
        reason: `Phase5 ${suffix} race-a`,
        performedBy: adminUserId,
      }),
      applyStockMovement({
        medicineId,
        batchId,
        type: 'SALE',
        quantity: 4,
        reason: `Phase5 ${suffix} race-b`,
        performedBy: adminUserId,
      }),
    ])

    const fulfilled = results.filter((item) => item.status === 'fulfilled')
    const rejected = results.filter((item) => item.status === 'rejected')

    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 1)

    const batch = await Batch.findById(batchId)
    assert.equal(batch?.quantity, 1)
  })
})
