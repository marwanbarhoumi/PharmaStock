export interface SeedEnv {
  NODE_ENV: string
  MONGODB_URI: string
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): SeedEnv {
  const NODE_ENV = source.NODE_ENV?.trim() || 'development'
  const explicitUri = source.MONGODB_URI?.trim()

  if (NODE_ENV === 'production' && !explicitUri) {
    throw new Error('MONGODB_URI must be set explicitly in production')
  }

  return {
    NODE_ENV,
    MONGODB_URI: explicitUri || 'mongodb://localhost:27017/pharmastock',
  }
}
