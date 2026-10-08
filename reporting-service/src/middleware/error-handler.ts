import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { ZodError } from 'zod'

import { AppError } from '../utils/app-error.js'
import { loadEnv } from '../config/env.js'

const DATA_UNAVAILABLE_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoExpiredSessionError',
])

/** MongoDB unreachable or disconnected: the report cannot be computed. */
function isDataUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (DATA_UNAVAILABLE_ERRORS.has(err.name)) return true
  return (
    err.name === 'MongooseError' &&
    /bufferCommands = false|initial connection|Client must be connected|connection .* closed/i.test(
      err.message,
    )
  )
}

function formatZodErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || undefined,
    message: issue.message,
  }))
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const env = (() => {
    try {
      return loadEnv()
    } catch {
      return { NODE_ENV: process.env.NODE_ENV ?? 'development' }
    }
  })()

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors ?? [],
    })
    return
  }

  // express.json / body-parser syntax errors (invalid JSON body)
  if (
    err instanceof SyntaxError &&
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON body',
      errors: [],
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: formatZodErrors(err),
    })
    return
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((item) => ({
      path: item.path,
      message: item.message,
    }))

    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    })
    return
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: 'Invalid identifier',
      errors: [
        {
          path: err.path,
          message:
            env.NODE_ENV === 'production'
              ? 'Invalid identifier'
              : err.message,
        },
      ],
    })
    return
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  ) {
    const duplicate = err as {
      keyValue?: Record<string, unknown>
      message?: string
    }
    const fields = duplicate.keyValue
      ? Object.keys(duplicate.keyValue).join(', ')
      : 'field'

    res.status(409).json({
      success: false,
      message: `Duplicate value for ${fields}`,
      errors: [
        {
          path: fields,
          message: 'A resource with this value already exists',
        },
      ],
    })
    return
  }

  if (isDataUnavailable(err)) {
    console.error('[reporting] data source unavailable:', err instanceof Error ? err.message : err)
    res.status(503).json({
      success: false,
      message: 'Reporting data source unavailable',
      errors: [],
    })
    return
  }

  console.error(err)

  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error'

  res.status(500).json({
    success: false,
    message,
    errors: [],
  })
}
