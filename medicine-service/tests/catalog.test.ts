import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { loadEnv } from '../src/config/env.js'
import { Category, Medicine, User } from '../src/models/index.js'
import { hashPassword } from '../src/utils/password.js'
import { signAccessToken } from '../src/utils/jwt.js'

describe('Medicine Service catalog API', () => {
  let app: Express
  let adminToken = ''
  let employeeToken = ''
  const suffix = Date.now().toString()

  before(async () => {
    const env = loadEnv()
    await connectDatabase(env.MONGODB_URI)
    app = createApp(env)

    const password = await hashPassword('Password123!')
    const admin = await User.create({
      firstName: 'Med',
      lastName: 'Admin',
      email: `med-admin-${suffix}@pharmastock.local`,
      password,
      role: 'ADMIN',
    })
    const employee = await User.create({
      firstName: 'Med',
      lastName: 'Employee',
      email: `med-emp-${suffix}@pharmastock.local`,
      password,
      role: 'EMPLOYEE',
    })

    adminToken = signAccessToken(
      { sub: admin._id.toString(), email: admin.email, role: 'ADMIN' },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    )
    employeeToken = signAccessToken(
      {
        sub: employee._id.toString(),
        email: employee.email,
        role: 'EMPLOYEE',
      },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    )
  })

  after(async () => {
    await Medicine.deleteMany({
      name: { $regex: `^Phase4-${suffix}` },
    })
    await Category.deleteMany({
      name: { $regex: `^Phase4Cat-${suffix}` },
    })
    await User.deleteMany({
      email: {
        $in: [
          `med-admin-${suffix}@pharmastock.local`,
          `med-emp-${suffix}@pharmastock.local`,
        ],
      },
    })
    await disconnectDatabase()
  })

  beforeEach(async () => {
    await Medicine.deleteMany({ name: { $regex: `^Phase4-${suffix}` } })
    await Category.deleteMany({ name: { $regex: `^Phase4Cat-${suffix}` } })
  })

  it('keeps health public', async () => {
    const response = await request(app).get('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.service, 'medicine')
  })

  it('requires auth for catalog reads', async () => {
    const response = await request(app).get('/api/categories')
    assert.equal(response.status, 401)
  })

  it('allows employee to read categories and denies writes', async () => {
    const list = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${employeeToken}`)
    assert.equal(list.status, 200)

    const create = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: `Phase4Cat-${suffix}-blocked` })
    assert.equal(create.status, 403)
  })

  it('creates, lists, updates, and soft-deletes categories as admin', async () => {
    const name = `Phase4Cat-${suffix}-main`
    const created = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, description: 'phase4' })
    assert.equal(created.status, 201)
    const id = created.body.data._id as string

    const listed = await request(app)
      .get(`/api/categories?search=${encodeURIComponent(name)}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(listed.status, 200)
    assert.ok(
      (listed.body.data as Array<{ name: string }>).some((c) => c.name === name),
    )

    const byId = await request(app)
      .get(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(byId.status, 200)
    assert.equal(byId.body.data.name, name)

    const updated = await request(app)
      .put(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'updated' })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.data.description, 'updated')

    const deleted = await request(app)
      .delete(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(deleted.status, 200)
    assert.equal(deleted.body.data.isActive, false)
  })

  it('creates medicines, looks up by barcode, and enforces RBAC', async () => {
    const cat = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase4Cat-${suffix}-med` })
    assert.equal(cat.status, 201)
    const categoryId = cat.body.data._id as string
    const barcode = `P4-${suffix}-BC`

    const blocked = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: `Phase4-${suffix}-Aspirin`,
        category: categoryId,
        purchasePrice: 1,
        sellingPrice: 2,
        minimumStock: 1,
        barcode,
      })
    assert.equal(blocked.status, 403)

    const created = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Phase4-${suffix}-Aspirin`,
        category: categoryId,
        purchasePrice: 1,
        sellingPrice: 2,
        minimumStock: 1,
        barcode,
      })
    assert.equal(created.status, 201)
    const medicineId = created.body.data._id as string

    const byBarcode = await request(app)
      .get(`/api/medicines/barcode/${barcode}`)
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(byBarcode.status, 200)
    assert.equal(byBarcode.body.data.barcode, barcode)

    const missing = await request(app)
      .get('/api/medicines/barcode/DOES-NOT-EXIST-P4')
      .set('Authorization', `Bearer ${adminToken}`)
    assert.equal(missing.status, 404)

    const internal = await request(app).get(
      `/internal/catalog/medicines/${medicineId}`,
    )
    assert.equal(internal.status, 200)
    assert.equal(internal.body.data.name, `Phase4-${suffix}-Aspirin`)
  })
})
