import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/pharmastock'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  /** Days before expiration that trigger EXPIRATION_WARNING alerts. */
  EXPIRATION_WARNING_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** How often automatic stock checks run (milliseconds). */
  STOCK_CHECK_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(3_600_000),
  /** When false, the stock-check scheduler does not start. */
  STOCK_CHECK_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment variables: ${details}`)
  }

  return parsed.data
}
