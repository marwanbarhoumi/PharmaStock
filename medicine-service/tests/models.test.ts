import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import { Category, Medicine } from '../src/models/index.js'

function isValidationOrDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /validation|required|duplicate|E11000/i.test(error.message)
}

describe('Medicine Service models', () => {
  let mongo: MongoMemoryServer

  before(async () => {
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
    await Promise.all([Category.init(), Medicine.init()])
  })

  after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  it('validates Category uniqueness and required name', async () => {
    await assert.rejects(() => Category.create({}), isValidationOrDuplicateError)

    const category = await Category.create({
      name: `Test Category ${Date.now()}`,
      description: 'Temporary test category',
    })

    await assert.rejects(
      () => Category.create({ name: category.name }),
      isValidationOrDuplicateError,
    )
  })

  it('validates Medicine price and stock constraints', async () => {
    const category = await Category.create({
      name: `Med Cat ${Date.now()}`,
    })

    await assert.rejects(
      () =>
        Medicine.create({
          name: 'Invalid Medicine',
          category: category._id,
          purchasePrice: -1,
          sellingPrice: -5,
          minimumStock: -2,
        }),
      isValidationOrDuplicateError,
    )

    const medicine = await Medicine.create({
      name: `Valid Medicine ${Date.now()}`,
      category: category._id,
      barcode: `TEST-${Date.now()}`,
      purchasePrice: 2,
      sellingPrice: 4,
      minimumStock: 5,
    })

    assert.ok(medicine._id)
  })
})
