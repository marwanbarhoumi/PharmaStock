import 'dotenv/config'

import { createGatewayApp } from './app.js'
import { loadGatewayEnv } from './config/env.js'

async function bootstrap() {
  const env = loadGatewayEnv()
  const app = createGatewayApp(env)

  const server = app.listen(env.PORT, () => {
    console.log(
      `PharmaStock Gateway listening on http://localhost:${env.PORT}`,
    )
    console.log(`Proxying /api/auth/*, /api/audit-logs → ${env.AUTH_URL}`)
    console.log(
      `Proxying /api/medicines/*, /api/categories/* → ${env.MEDICINE_URL}`,
    )
    console.log(
      `Proxying /api/batches/*, /api/stock/*, /api/alerts/* (except /api/alerts/check) → ${env.INVENTORY_URL}`,
    )
    console.log(
      `Proxying /api/notifications/*, /api/alerts/check → ${env.NOTIFICATION_URL}`,
    )
    console.log(`Proxying /api/sales/* → ${env.SALES_URL}`)
    console.log(`Proxying /api/purchases/*, /api/suppliers/* → ${env.PURCHASE_URL}`)
    console.log(`Proxying /api/dashboard/*, /api/reports/* → ${env.REPORTING_URL}`)
    console.log('Other /api/* → 404 (no fallback upstream)')
    console.log(`Gateway health: http://localhost:${env.PORT}/gateway/health`)
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${env.PORT} is already in use. Stop the conflicting process or change PORT.`,
      )
    } else {
      console.error('Failed to bind PharmaStock Gateway', error)
    }
    process.exit(1)
  })
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start PharmaStock Gateway', error)
  process.exit(1)
})
