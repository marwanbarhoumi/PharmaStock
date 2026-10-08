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
import { applyStockMovement } from '../src/services/stock-movement.service.js'
import { getStockDirection } from '../src/utils/stock-direction.js'

function isValidationOrDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /validation|required|duplicate|E11000/i.test(error.message)
}

describe('Inventory Service models and movement directions', () => {
  let mongo: MongoMemoryServer
  let userId = ''
  let medicineId = ''
  let batchId = ''

  before(async () => {
    process.env.NODE_ENV = 'test'
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
    await Batch.init()

    const user = await User.create({
      firstName: 'Model',
      lastName: 'Tester',
      email: 'inventory-models@pharmastock.local',
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
      StockMovement.deleteMany({}),
      Batch.deleteMany({}),
      Medicine.deleteMany({}),
      Category.deleteMany({}),
    ])
    const category = await Category.create({ name: 'Models Category' })
    const medicine = await Medicine.create({
      name: 'Models Medicine',
      category: category._id,
      barcode: 'MODELS-MED',
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 1,
    })
    medicineId = medicine._id.toString()
    const batch = await Batch.create({
      medicine: medicine._id,
      batchNumber: 'MODELS-A',
      quantity: 10,
      purchasePrice: 1,
      expirationDate: new Date('2028-06-01'),
    })
    batchId = batch._id.toString()
  })

  it('validates Batch constraints and unique medicine+batchNumber', async () => {
    await assert.rejects(
      () =>
        Batch.create({
          medicine: medicineId,
          batchNumber: 'B-001',
          quantity: -1,
          purchasePrice: -2,
        }),
      isValidationOrDuplicateError,
    )

    await Batch.create({
      medicine: medicineId,
      batchNumber: 'B-001',
      quantity: 10,
      purchasePrice: 1.5,
      expirationDate: new Date('2027-12-31'),
    })

    await assert.rejects(
      () =>
        Batch.create({
          medicine: medicineId,
          batchNumber: 'B-001',
          quantity: 5,
          purchasePrice: 1.5,
          expirationDate: new Date('2028-01-01'),
        }),
      isValidationOrDuplicateError,
    )
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
      reason: 'models purchase',
      performedBy: userId,
    })

    assert.equal(inbound.movement.previousQuantity, 10)
    assert.equal(inbound.movement.newQuantity, 15)
    assert.equal(inbound.batch.quantity, 15)

    const outbound = await applyStockMovement({
      medicineId,
      batchId,
      type: 'SALE',
      quantity: 4,
      reason: 'models sale',
      performedBy: userId,
    })

    assert.equal(outbound.movement.previousQuantity, 15)
    assert.equal(outbound.movement.newQuantity, 11)
    assert.equal((await Batch.findById(batchId))?.quantity, 11)
  })

  it('applies all remaining movement types', async () => {
    for (const [type, quantity] of [
      ['ADJUSTMENT_IN', 2],
      ['RETURN_IN', 1],
      ['ADJUSTMENT_OUT', 3],
      ['RETURN_OUT', 1],
    ] as const) {
      await applyStockMovement({
        medicineId,
        batchId,
        type,
        quantity,
        reason: `models ${type}`,
        performedBy: userId,
      })
    }

    assert.equal((await Batch.findById(batchId))?.quantity, 9)
  })
})
