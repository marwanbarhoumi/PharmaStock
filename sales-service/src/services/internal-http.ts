import { loadEnv } from '../config/env.js'
import { AppError } from '../utils/app-error.js'

/**
 * - `not_applied`: the remote side certainly did not apply the request
 *   (connection refused, or it answered with an error status).
 * - `unknown`: the request may have been applied (timeout or connection lost
 *   after sending). Never retry or compensate automatically; reconcile manually.
 */
export type RemoteOutcome = 'not_applied' | 'unknown'

export class ServiceCallError extends AppError {
  readonly outcome: RemoteOutcome

  constructor(
    message: string,
    statusCode: number,
    outcome: RemoteOutcome,
    errors?: unknown[],
  ) {
    super(message, statusCode, errors)
    this.name = 'ServiceCallError'
    this.outcome = outcome
  }
}

const NOT_CONNECTED_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'])

function connectionErrorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string; errors?: { code?: string }[] } })
    ?.cause
  return cause?.code ?? cause?.errors?.[0]?.code
}

interface CallOptions {
  service: string
  baseUrl: string
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  internalToken?: boolean
}

/** Single attempt, no automatic retries. Returns the `data` field of the response. */
export async function callService<T>(options: CallOptions): Promise<T> {
  const env = loadEnv()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.internalToken && env.INTERNAL_API_TOKEN) {
    headers['x-internal-token'] = env.INTERNAL_API_TOKEN
  }
  const label = `${options.method} ${options.path}`
  const unavailable = `${options.service} unavailable`

  let response: Response
  try {
    response = await fetch(`${options.baseUrl}${options.path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(env.SERVICE_TIMEOUT_MS),
    })
  } catch (error) {
    const code = connectionErrorCode(error)
    const outcome: RemoteOutcome =
      options.method === 'GET' || (code && NOT_CONNECTED_CODES.has(code))
        ? 'not_applied'
        : 'unknown'
    console.error(
      `[sales] ${options.service} ${label} failed (${code ?? (error as Error)?.name ?? 'error'}; outcome ${outcome})`,
    )
    throw new ServiceCallError(unavailable, 503, outcome)
  }

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string
    errors?: unknown[]
    data?: T
  }

  if (!response.ok) {
    if (response.status >= 500) {
      console.error(
        `[sales] ${options.service} ${label} returned ${response.status} ${payload.message ?? ''}`,
      )
    }
    throw new ServiceCallError(
      response.status >= 500 ? unavailable : (payload.message ?? `${options.service} request failed`),
      response.status >= 500 ? 503 : response.status,
      'not_applied',
      payload.errors ?? [],
    )
  }

  return payload.data as T
}
