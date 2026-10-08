import mongoose from 'mongoose'

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true)

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
    const connection = await mongoose.connect(uri)
    const dbName = connection.connection.name
    console.log(`MongoDB ready (database: ${dbName})`)
    return connection
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown MongoDB connection error'
    console.error(`Failed to connect to MongoDB: ${message}`)
    console.error(
      'Ensure MongoDB is running and MONGODB_URI is correct (see medicine-service/.env.example).',
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
