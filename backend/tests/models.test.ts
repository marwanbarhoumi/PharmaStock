import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import 'dotenv/config'

import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
} from '../src/config/database.js'
import { loadEnv } from '../src/config/env.js'
import {
  Batch,
  Category,
  Medicine,
  Supplier,
  User,
} from '../src/models/index.js'

function isValidationOrDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /validation|required|duplicate|E11000/i.test(error.message)
}

describe('PharmaStock database layer', () => {
  before(async () => {
    const env = loadEnv()
    await connectDatabase(env.MONGODB_URI)
  })

  after(async () => {
    await disconnectDatabase()
  })

  it('connects to MongoDB', () => {
    assert.equal(getDatabaseStatus(), 'connected')
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

    await User.deleteOne({ _id: user._id })
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

    await Category.deleteOne({ _id: category._id })
  })

  it('validates Supplier required name and optional email', async () => {
    await assert.rejects(() => Supplier.create({}), isValidationOrDuplicateError)

    const supplier = await Supplier.create({
      name: `Temp Supplier ${Date.now()}`,
      phone: '+21670000000',
    })

    assert.ok(supplier.name)
    assert.equal(supplier.isActive, true)

    await Supplier.deleteOne({ _id: supplier._id })
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

    await Medicine.deleteOne({ _id: medicine._id })
    await Category.deleteOne({ _id: category._id })
  })

  it('validates Batch constraints and unique medicine+batchNumber', async () => {
    const category = await Category.create({
      name: `Batch Cat ${Date.now()}`,
    })
    const medicine = await Medicine.create({
      name: `Batch Medicine ${Date.now()}`,
      category: category._id,
      barcode: `BATCH-MED-${Date.now()}`,
      purchasePrice: 1,
      sellingPrice: 2,
      minimumStock: 1,
    })

    await assert.rejects(
      () =>
        Batch.create({
          medicine: medicine._id,
          batchNumber: 'B-001',
          quantity: -1,
          purchasePrice: -2,
        }),
      isValidationOrDuplicateError,
    )

    const batch = await Batch.create({
      medicine: medicine._id,
      batchNumber: 'B-001',
      quantity: 10,
      purchasePrice: 1.5,
      expirationDate: new Date('2027-12-31'),
    })

    await assert.rejects(
      () =>
        Batch.create({
          medicine: medicine._id,
          batchNumber: 'B-001',
          quantity: 5,
          purchasePrice: 1.5,
          expirationDate: new Date('2028-01-01'),
        }),
      isValidationOrDuplicateError,
    )

    await Batch.deleteOne({ _id: batch._id })
    await Medicine.deleteOne({ _id: medicine._id })
    await Category.deleteOne({ _id: category._id })
  })
})
