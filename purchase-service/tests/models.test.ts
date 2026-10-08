import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import { Supplier } from '../src/models/index.js'

function isValidationOrDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /validation|required|duplicate|E11000/i.test(error.message)
}

describe('Purchase Service models', () => {
  let mongo: MongoMemoryServer

  before(async () => {
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
  })

  after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  it('validates Supplier required name and optional email', async () => {
    await assert.rejects(() => Supplier.create({}), isValidationOrDuplicateError)

    const supplier = await Supplier.create({
      name: `Temp Supplier ${Date.now()}`,
      phone: '+21670000000',
    })

    assert.ok(supplier.name)
    assert.equal(supplier.isActive, true)
  })
})
