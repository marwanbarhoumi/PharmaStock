import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5002),
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
  ALLOW_PUBLIC_REGISTER: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        const nodeEnv = process.env.NODE_ENV ?? 'development'
        return nodeEnv !== 'production'
      }
      return value === 'true'
    }),
})

export type Env = z.infer<typeof envSchema>

const INSECURE_JWT_SECRETS = new Set([
  'change_me_to_a_long_random_secret',
  'your_super_secret_key',
  'your_super_secret_key_change_me',
])

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

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
  }

  return env
}
