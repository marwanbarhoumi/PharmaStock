import type { ClientSession } from 'mongoose'
import mongoose from 'mongoose'

/**
 * Runs work inside a MongoDB transaction when the deployment supports it
 * (replica set / mongos). Falls back to non-transactional execution on
 * standalone MongoDB, which is common in local development.
 */
export async function withOptionalTransaction<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<{ result: T; usedTransaction: boolean }> {
  const session = await mongoose.startSession()

  try {
    let result!: T
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return { result, usedTransaction: true }
  } catch (error: unknown) {
    if (isTransactionUnsupported(error)) {
      const result = await work(null)
      return { result, usedTransaction: false }
    }
    throw error
  } finally {
    await session.endSession()
  }
}

export function isTransactionUnsupported(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const maybe = error as {
    code?: number
    codeName?: string
    message?: string
  }

  const message = maybe.message?.toLowerCase() ?? ''

  return (
    maybe.code === 20 ||
    maybe.codeName === 'IllegalOperation' ||
    message.includes('transaction numbers are only allowed') ||
    message.includes('transactions are not supported') ||
    (message.includes('transaction') && message.includes('replica set'))
  )
}
