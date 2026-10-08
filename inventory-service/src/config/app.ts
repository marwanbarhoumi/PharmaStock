import type { CorsOptions } from 'cors'

import type { Env } from './env.js'

export const appConfig = {
  name: 'PharmaStock Inventory Service',
  apiPrefix: '/api',
} as const

export function getAllowedCorsOrigins(env: Env): string[] {
  return Array.from(new Set([env.CLIENT_URL, ...(env.CORS_ORIGINS ?? [])]))
}

export function getCorsOrigin(env: Env): CorsOptions['origin'] {
  const allowed = getAllowedCorsOrigins(env)

  return (origin, callback) => {
    if (!origin) {
      callback(null, true)
      return
    }
    if (allowed.includes(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  }
}
