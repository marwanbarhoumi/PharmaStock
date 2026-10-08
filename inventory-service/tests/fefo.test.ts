import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import {
  Batch,
  Category,
  Medicine,
  StockMovement,
  User,
} from '../src/models/index.js'
import { allocateByFefo } from '../src/services/fefo.service.js'
import { applyStockMovement } from '../src/services/stock-movement.service.js'
import { AppError } from '../src/utils/app-error.js'

const DAY = 24 * 60 * 60 * 1000

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY)
}

async function expectAppError(
  promise: Promise<unknown>,
  statusCode: number,
  message: string | RegExp,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppError, 'expected AppError')
    assert.equal(error.statusCode, statusCode)
    if (typeof message === 'string') {
      assert.equal(error.message, message)
    } else {
      assert.match(error.message, message)
    }
    return true
  })
}

describe('Inventory Service FEFO + stock movements', () => {
  let mongo: MongoMemoryServer
  let medicineId = ''
  let userId = ''

  before(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'test_jwt_secret_key_123'
    delete process.env.AUTH_SERVICE_URL
    delete process.env.MEDICINE_SERVICE_URL
    mongo = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongo.getUri()
    await mongoose.connect(mongo.getUri())

    const user = await User.create({
      firstName: 'Fefo',
      lastName: 'Tester',
      email: 'fefo@pharmastock.local',
      password: 'not-used-hash',
      role: 'ADMIN',
    })
    userId = user._id.toString()
  })

  after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    await Promise.all([
      Batch.deleteMany({}),
      StockMovement.deleteMany({}),
      Medicine.deleteMany({}),
      Category.deleteMany({}),
    ])
    const category = await Category.create({ name: 'FEFO Category' })
    const medicine = await Medicine.create({
      name: 'FEFO Medicine',
      category: category._id,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 5,
    })
    medicineId = medicine._id.toString()
  })

  async function createBatch(
    batchNumber: string,
    quantity: number,
    expiresInDays: number,
    isActive = true,
  ) {
    return Batch.create({
      medicine: medicineId,
      batchNumber,
      quantity,
      purchasePrice: 1,
      expirationDate: daysFromNow(expiresInDays),
      isActive,
    })
  }

  it('orders multiple batches by earliest expiration first', async () => {
    await createBatch('LATE', 10, 200)
    await createBatch('EARLY', 10, 20)
    await createBatch('MID', 10, 90)

    const plan = await allocateByFefo(medicineId, 5)
    assert.equal(plan.allocations.length, 1)
    assert.equal(plan.allocations[0]?.batchNumber, 'EARLY')
    assert.equal(plan.allocatedQuantity, 5)
    assert.equal(plan.requestedQuantity, 5)
  })

  it('supports partial consumption of a single batch', async () => {
    await createBatch('ONLY', 10, 30)
    const plan = await allocateByFefo(medicineId, 4)
    assert.equal(plan.allocations.length, 1)
    assert.equal(plan.allocations[0]?.availableQuantity, 10)
    assert.equal(plan.allocations[0]?.allocatedQuantity, 4)
  })

  it('allocates across multiple batches in FEFO order', async () => {
    await createBatch('B2', 5, 60)
    await createBatch('B1', 3, 10)
    await createBatch('B3', 50, 120)

    const plan = await allocateByFefo(medicineId, 10)
    assert.deepEqual(
      plan.allocations.map((a) => [a.batchNumber, a.allocatedQuantity]),
      [
        ['B1', 3],
        ['B2', 5],
        ['B3', 2],
      ],
    )
    assert.equal(plan.allocatedQuantity, 10)
  })

  it('rejects insufficient stock with 409 and the missing quantity', async () => {
    await createBatch('SMALL', 3, 30)
    await expectAppError(
      allocateByFefo(medicineId, 5),
      409,
      'Insufficient eligible stock for FEFO allocation. Missing 2 unit(s).',
    )
  })

  it('ignores expired, inactive, and empty batches', async () => {
    await createBatch('EXPIRED', 100, -2)
    await createBatch('INACTIVE', 100, 5, false)
    await createBatch('EMPTY', 0, 3)
    await createBatch('VALID', 4, 40)

    const plan = await allocateByFefo(medicineId, 4)
    assert.deepEqual(
      plan.allocations.map((a) => a.batchNumber),
      ['VALID'],
    )
    await expectAppError(allocateByFefo(medicineId, 5), 409, /Missing 1 unit/)
  })

  it('rejects zero, negative, and fractional quantities with 400', async () => {
    await createBatch('ANY', 10, 30)
    await expectAppError(allocateByFefo(medicineId, 0), 400, /positive/)
    await expectAppError(allocateByFefo(medicineId, -1), 400, /positive/)
    await expectAppError(allocateByFefo(medicineId, 1.5), 400, /integer/)
  })

  it('applies OUT movements atomically and never goes negative', async () => {
    const batch = await createBatch('MOVE', 5, 30)

    const out = await applyStockMovement({
      medicineId,
      batchId: batch._id.toString(),
      type: 'SALE',
      quantity: 3,
      referenceType: 'SALE',
      performedBy: userId,
    })
    assert.equal(out.movement.previousQuantity, 5)
    assert.equal(out.movement.newQuantity, 2)
    assert.equal(out.batch.quantity, 2)

    await expectAppError(
      applyStockMovement({
        medicineId,
        batchId: batch._id.toString(),
        type: 'SALE',
        quantity: 3,
        performedBy: userId,
      }),
      409,
      'Insufficient batch quantity for this movement',
    )

    const reloaded = await Batch.findById(batch._id).lean()
    assert.equal(reloaded?.quantity, 2)
    assert.equal(await StockMovement.countDocuments({}), 1)
  })

  it('does not oversell under concurrent OUT movements', async () => {
    const batch = await createBatch('RACE', 5, 30)
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        applyStockMovement({
          medicineId,
          batchId: batch._id.toString(),
          type: 'SALE',
          quantity: 2,
          performedBy: userId,
        }),
      ),
    )
    const succeeded = attempts.filter((a) => a.status === 'fulfilled').length
    assert.equal(succeeded, 2)
    const reloaded = await Batch.findById(batch._id).lean()
    assert.equal(reloaded?.quantity, 1)
    assert.equal(await StockMovement.countDocuments({}), 2)
  })

  it('restores stock with RETURN_IN so FEFO can reallocate it', async () => {
    const batch = await createBatch('RESTORE', 4, 30)
    await applyStockMovement({
      medicineId,
      batchId: batch._id.toString(),
      type: 'SALE',
      quantity: 4,
      performedBy: userId,
    })
    await expectAppError(allocateByFefo(medicineId, 1), 409, /Missing 1 unit/)

    const restored = await applyStockMovement({
      medicineId,
      batchId: batch._id.toString(),
      type: 'RETURN_IN',
      quantity: 4,
      reason: 'Sale cancelled',
      referenceType: 'SALE',
      performedBy: userId,
    })
    assert.equal(restored.movement.newQuantity, 4)

    const plan = await allocateByFefo(medicineId, 4)
    assert.equal(plan.allocations[0]?.batchNumber, 'RESTORE')
    assert.equal(await StockMovement.countDocuments({}), 2)
  })

  it('rejects inactive batches and mismatched medicines', async () => {
    const inactive = await createBatch('OFF', 5, 30, false)
    await expectAppError(
      applyStockMovement({
        medicineId,
        batchId: inactive._id.toString(),
        type: 'ADJUSTMENT_IN',
        quantity: 1,
        performedBy: userId,
      }),
      409,
      'Batch is inactive',
    )

    const otherCategory = await Category.create({ name: 'Other' })
    const other = await Medicine.create({
      name: 'Other Medicine',
      category: otherCategory._id,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 0,
    })
    const active = await createBatch('ON', 5, 30)
    await expectAppError(
      applyStockMovement({
        medicineId: other._id.toString(),
        batchId: active._id.toString(),
        type: 'ADJUSTMENT_IN',
        quantity: 1,
        performedBy: userId,
      }),
      400,
      'Batch does not belong to the specified medicine',
    )
  })
})
