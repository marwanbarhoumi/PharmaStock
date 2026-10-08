import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5006),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://127.0.0.1:27017/pharmastock'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  /**
   * Auth Service base URL for JWT + isActive introspection.
   * Required in production; optional in unit tests (local JWT + User fallback).
   */
  AUTH_SERVICE_URL: z.string().url().optional(),
  /** Medicine Service base URL: medicine validation and display fields. */
  MEDICINE_SERVICE_URL: z.string().url().default('http://127.0.0.1:5003'),
  /** Inventory Service base URL: FEFO plans, stock movements and batch display fields. */
  INVENTORY_SERVICE_URL: z.string().url().default('http://127.0.0.1:5004'),
  /** Per-request timeout for internal service calls (milliseconds). */
  SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),
  /** Optional shared secret sent as x-internal-token on internal service calls. */
  INTERNAL_API_TOKEN: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

const INSECURE_JWT_SECRETS = new Set([
  'change_me_to_a_long_random_secret',
  'your_super_secret_key',
  'your_super_secret_key_change_me',
])

export function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    ...process.env,
    INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN?.trim() || undefined,
  })

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment variables: ${details}`)
  }

  const env = parsed.data

  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.length < 32) {
      throw new Error(
        'Invalid environment variables: JWT_SECRET must be at least 32 characters in production',
      )
    }
    if (INSECURE_JWT_SECRETS.has(env.JWT_SECRET)) {
      throw new Error(
        'Invalid environment variables: JWT_SECRET must not use a documented placeholder value in production',
      )
    }
    if (!process.env.MONGODB_URI?.trim()) {
      throw new Error(
        'Invalid environment variables: MONGODB_URI must be set explicitly in production',
      )
    }
    if (!env.AUTH_SERVICE_URL) {
      throw new Error(
        'Invalid environment variables: AUTH_SERVICE_URL must be set in production',
      )
    }
    for (const key of ['MEDICINE_SERVICE_URL', 'INVENTORY_SERVICE_URL'] as const) {
      if (!process.env[key]?.trim()) {
        throw new Error(
          `Invalid environment variables: ${key} must be set explicitly in production`,
        )
      }
    }
  }

  return env
}
