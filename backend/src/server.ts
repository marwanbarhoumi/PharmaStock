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

  app.listen(env.PORT, () => {
    console.log(`PharmaStock API listening on http://localhost:${env.PORT}`)
    console.log(`Health check: http://localhost:${env.PORT}/api/health`)
  })
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start PharmaStock API', error)
  process.exit(1)
})
