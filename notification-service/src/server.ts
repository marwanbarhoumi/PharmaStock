import 'dotenv/config'

import { createApp } from './app.js'
import { connectDatabase } from './config/database.js'
import { loadEnv } from './config/env.js'
import { startStockCheckScheduler } from './services/stock-check-scheduler.js'

async function bootstrap() {
  const env = loadEnv()
  await connectDatabase(env.MONGODB_URI)

  const app = createApp(env)
  startStockCheckScheduler(env)

  const server = app.listen(env.PORT, () => {
    console.log(
      `PharmaStock Notification Service listening on http://localhost:${env.PORT}`,
    )
    console.log(`Health: http://localhost:${env.PORT}/api/health`)
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${env.PORT} is already in use. Stop the other process or change PORT.`,
      )
    } else {
      console.error('Failed to bind Notification Service', error)
    }
    process.exit(1)
  })
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start PharmaStock Notification Service', error)
  process.exit(1)
})
