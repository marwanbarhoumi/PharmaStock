import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import { User } from '../src/models/index.js'

function isValidationOrDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /validation|required|duplicate|E11000/i.test(error.message)
}

describe('Auth Service models', () => {
  let mongo: MongoMemoryServer

  before(async () => {
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
    await User.init()
  })

  after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  it('validates User schema rules', async () => {
    await assert.rejects(
      () =>
        User.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'not-an-email',
          password: 'short',
          role: 'INVALID',
        }),
      isValidationOrDuplicateError,
    )

    const user = await User.create({
      firstName: 'Schema',
      lastName: 'Check',
      email: 'Schema.Check@PharmaStock.Local',
      password: 'Password123!',
      role: 'PHARMACIST',
    })

    assert.equal(user.email, 'schema.check@pharmastock.local')
    assert.equal(user.role, 'PHARMACIST')

    await assert.rejects(
      () =>
        User.create({
          firstName: 'Schema',
          lastName: 'Duplicate',
          email: 'schema.check@pharmastock.local',
          password: 'Password123!',
        }),
      isValidationOrDuplicateError,
    )
  })
})
