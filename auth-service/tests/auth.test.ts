import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { loadEnv } from '../src/config/env.js'
import { User } from '../src/models/index.js'
import { comparePassword, hashPassword } from '../src/utils/password.js'

describe('Auth Service API', () => {
  let app: Express
  const suffix = Date.now().toString()

  before(async () => {
    const env = loadEnv()
    await connectDatabase(env.MONGODB_URI)
    app = createApp(env)
  })

  after(async () => {
    await User.deleteMany({
      email: {
        $regex: `-(${suffix})@pharmastock\\.local$`,
      },
    })
    await disconnectDatabase()
  })

  beforeEach(async () => {
    await User.deleteMany({
      email: {
        $in: [
          `ada-${suffix}@pharmastock.local`,
          `test-${suffix}@pharmastock.local`,
          `jwt-${suffix}@pharmastock.local`,
          `inactive-${suffix}@pharmastock.local`,
        ],
      },
    })
  })

  it('registers a user with hashed password and EMPLOYEE role', async () => {
    const email = `ada-${suffix}@pharmastock.local`
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      password: 'Password123!',
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.user.email, email)
    assert.equal(response.body.data.user.role, 'EMPLOYEE')
    assert.equal(response.body.data.user.password, undefined)
    assert.ok(response.body.data.accessToken)

    const stored = await User.findOne({ email }).select('+password')
    assert.ok(stored)
    assert.notEqual(stored.password, 'Password123!')
    assert.equal(await comparePassword('Password123!', stored.password), true)
  })

  it('rejects duplicate email registration', async () => {
    const email = `ada-${suffix}@pharmastock.local`
    await request(app).post('/api/auth/register').send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      password: 'Password123!',
    })

    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Ada',
      lastName: 'Two',
      email,
      password: 'Password123!',
    })

    assert.equal(response.status, 409)
    assert.equal(response.body.success, false)
  })

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const email = `test-${suffix}@pharmastock.local`
    await request(app).post('/api/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email,
      password: 'Password123!',
    })

    const success = await request(app).post('/api/auth/login').send({
      email,
      password: 'Password123!',
    })

    assert.equal(success.status, 200)
    assert.ok(success.body.data.accessToken)

    const wrongPassword = await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPassword!',
    })
    assert.equal(wrongPassword.status, 401)
    assert.equal(wrongPassword.body.message, 'Invalid email or password')

    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: `missing-${suffix}@pharmastock.local`,
      password: 'Password123!',
    })
    assert.equal(unknownEmail.status, 401)
    assert.equal(unknownEmail.body.message, 'Invalid email or password')
  })

  it('returns current user for valid JWT and 401 without/invalid token', async () => {
    const email = `jwt-${suffix}@pharmastock.local`
    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'Jwt',
      lastName: 'User',
      email,
      password: 'Password123!',
    })

    const token = registered.body.data.accessToken as string

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(me.status, 200)
    assert.equal(me.body.data.email, email)
    assert.equal(me.body.data.password, undefined)

    const unauthorized = await request(app).get('/api/auth/me')
    assert.equal(unauthorized.status, 401)

    const invalid = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
    assert.equal(invalid.status, 401)
  })

  it('rejects inactive users on login and introspection', async () => {
    const email = `inactive-${suffix}@pharmastock.local`
    await User.create({
      firstName: 'In',
      lastName: 'Active',
      email,
      password: await hashPassword('Password123!'),
      role: 'EMPLOYEE',
      isActive: false,
    })

    const login = await request(app).post('/api/auth/login').send({
      email,
      password: 'Password123!',
    })
    assert.equal(login.status, 403)

    // Issue a token as if user were active, then deactivate path via introspect
    const activeEmail = `jwt-${suffix}@pharmastock.local`
    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'Jwt',
      lastName: 'User',
      email: activeEmail,
      password: 'Password123!',
    })
    const token = registered.body.data.accessToken as string
    await User.updateOne({ email: activeEmail }, { $set: { isActive: false } })

    const introspect = await request(app)
      .post('/internal/auth/introspect')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    assert.equal(introspect.status, 401)

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(me.status, 401)
  })

  it('introspects valid tokens for downstream services', async () => {
    const email = `jwt-${suffix}@pharmastock.local`
    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'Jwt',
      lastName: 'User',
      email,
      password: 'Password123!',
    })
    const token = registered.body.data.accessToken as string

    const response = await request(app)
      .post('/internal/auth/introspect')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    assert.equal(response.status, 200)
    assert.equal(response.body.data.active, true)
    assert.equal(response.body.data.user.email, email)
    assert.equal(response.body.data.claims.role, 'EMPLOYEE')
  })

  it('keeps health endpoint public', async () => {
    const response = await request(app).get('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.service, 'auth')
  })
})
