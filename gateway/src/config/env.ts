import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  AUTH_URL: z
    .string()
    .url('AUTH_URL must be a valid URL')
    .default('http://127.0.0.1:5002'),
  MEDICINE_URL: z
    .string()
    .url('MEDICINE_URL must be a valid URL')
    .default('http://127.0.0.1:5003'),
  INVENTORY_URL: z
    .string()
    .url('INVENTORY_URL must be a valid URL')
    .default('http://127.0.0.1:5004'),
  NOTIFICATION_URL: z
    .string()
    .url('NOTIFICATION_URL must be a valid URL')
    .default('http://127.0.0.1:5005'),
  SALES_URL: z
    .string()
    .url('SALES_URL must be a valid URL')
    .default('http://127.0.0.1:5006'),
  PURCHASE_URL: z
    .string()
    .url('PURCHASE_URL must be a valid URL')
    .default('http://127.0.0.1:5007'),
  REPORTING_URL: z
    .string()
    .url('REPORTING_URL must be a valid URL')
    .default('http://127.0.0.1:5008'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : [],
    ),
})

export type GatewayEnv = z.infer<typeof envSchema> & {
  CORS_ORIGINS: string[]
}

let cached: GatewayEnv | null = null

export function loadGatewayEnv(
  source: NodeJS.ProcessEnv = process.env,
): GatewayEnv {
  if (cached && source === process.env) {
    return cached
  }

  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid gateway environment: ${details}`)
  }

  const env = parsed.data as GatewayEnv
  if (source === process.env) {
    cached = env
  }
  return env
}

export function resetGatewayEnvCache(): void {
  cached = null
}
