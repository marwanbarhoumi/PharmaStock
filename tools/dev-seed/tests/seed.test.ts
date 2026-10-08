import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it } from 'node:test'
import { promisify } from 'node:util'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))

async function runSeed(env: Record<string, string>) {
  return run(process.execPath, ['--import', 'tsx', 'src/seed.ts'], {
    cwd: root,
    env: { ...process.env, ...env },
  })
}

describe('development seed', () => {
  let mongo: MongoMemoryServer
  let uri = ''

  before(async () => {
    mongo = await MongoMemoryServer.create()
    uri = `${mongo.getUri()}pharmastock`
    await mongoose.connect(uri)
  })

  after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  it('creates the admin, categories, suppliers, medicines and batches, and is repeatable', async () => {
    const db = mongoose.connection.db!
    await db.collection('users').insertOne({ email: 'keep@pharmastock.local' })

    for (let attempt = 0; attempt < 2; attempt++) {
      const { stdout } = await runSeed({ MONGODB_URI: uri, NODE_ENV: 'development' })
      assert.match(stdout, /Seed completed successfully/)
    }

    const admin = await db.collection('users').findOne({ email: 'admin@pharmastock.local' })
    assert.equal(admin?.role, 'ADMIN')
    assert.notEqual(admin?.password, 'Admin123!')
    assert.equal(await db.collection('users').countDocuments(), 2)
    assert.equal(await db.collection('categories').countDocuments(), 3)
    assert.equal(await db.collection('suppliers').countDocuments(), 3)
    assert.equal(await db.collection('medicines').countDocuments(), 3)
    assert.equal(await db.collection('batches').countDocuments(), 3)
  })

  it('refuses to seed in production without ALLOW_SEED', async () => {
    await assert.rejects(
      runSeed({ MONGODB_URI: uri, NODE_ENV: 'production', ALLOW_SEED: '' }),
      (error: { stderr?: string }) => /Seeding is blocked in production/.test(error.stderr ?? ''),
    )
  })
})
