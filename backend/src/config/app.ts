import type { Env } from './env.js'

export const appConfig = {
  name: 'PharmaStock API',
  apiPrefix: '/api',
} as const

export function getCorsOrigin(env: Env): string {
  return env.CLIENT_URL
}
