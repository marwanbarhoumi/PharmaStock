import mongoose from 'mongoose'

/**
 * Read-only connection: never builds indexes or creates collections
 * (those belong to the owning services), and fails fast instead of
 * buffering queries while MongoDB is unreachable.
 */
export const READ_ONLY_CONNECT_OPTIONS = {
  autoIndex: false,
  autoCreate: false,
  serverSelectionTimeoutMS: 5_000,
} as const

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true)
  mongoose.set('bufferCommands', false)

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected')
  })

  mongoose.connection.on('error', (error: unknown) => {
    console.error('MongoDB connection error:', error)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected')
  })

  try {
    const connection = await mongoose.connect(uri, READ_ONLY_CONNECT_OPTIONS)
    const dbName = connection.connection.name
    console.log(`MongoDB ready (database: ${dbName}, read-only access)`)
    return connection
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown MongoDB connection error'
    console.error(`Failed to connect to MongoDB: ${message}`)
    console.error(
      'Ensure MongoDB is running and MONGODB_URI is correct (see reporting-service/.env.example).',
    )
    throw error
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}

export function getDatabaseStatus(): 'connected' | 'connecting' | 'disconnected' | 'disconnecting' {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected'
    case 2:
      return 'connecting'
    case 3:
      return 'disconnecting'
    default:
      return 'disconnected'
  }
}
