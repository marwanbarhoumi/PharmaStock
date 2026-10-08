import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodType } from 'zod'

import { validationError } from '../utils/app-error.js'

type RequestTarget = 'body' | 'params' | 'query'

interface ValidateOptions {
  body?: ZodType
  params?: ZodType
  query?: ZodType
}

function formatZodErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || undefined,
    message: issue.message,
  }))
}

function applySchema(
  schema: ZodType,
  target: RequestTarget,
  req: Request,
): void {
  const parsed = schema.safeParse(req[target])

  if (!parsed.success) {
    throw validationError('Validation failed', formatZodErrors(parsed.error))
  }

  // Express 5 / Node may treat req.query as a getter-only property.
  Object.defineProperty(req, target, {
    value: parsed.data,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

export function validateRequest(options: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (options.params) {
        applySchema(options.params, 'params', req)
      }
      if (options.query) {
        applySchema(options.query, 'query', req)
      }
      if (options.body) {
        applySchema(options.body, 'body', req)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
