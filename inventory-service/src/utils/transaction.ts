import type { ClientSession } from 'mongoose'
import mongoose from 'mongoose'

function collectErrorText(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  let depth = 0

  while (current && depth < 6) {
    if (typeof current !== 'object') {
      break
    }

    const maybe = current as {
      message?: string
      code?: number
      codeName?: string
      originalError?: unknown
      cause?: unknown
    }

    if (maybe.message) {
      parts.push(maybe.message)
    }
    if (maybe.codeName) {
      parts.push(maybe.codeName)
    }
    if (typeof maybe.code === 'number') {
      parts.push(String(maybe.code))
    }

    current = maybe.originalError ?? maybe.cause
    depth += 1
  }

  return parts.join(' ').toLowerCase()
}

/**
 * Runs work inside a MongoDB transaction when the deployment supports it
 * (replica set / mongos). Falls back to non-transactional execution on
 * standalone MongoDB, which is common in local development and memory-server tests.
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
  }

  const text = collectErrorText(error)

  return (
    maybe.code === 20 ||
    maybe.codeName === 'IllegalOperation' ||
    text.includes('transaction numbers are only allowed') ||
    text.includes('transactions are not supported') ||
    text.includes('transaction') && text.includes('replica set') ||
    text.includes('retryable writes') ||
    text.includes('illegaloperation')
  )
}
