export class AppError extends Error {
  readonly statusCode: number
  readonly errors?: unknown[]
  readonly isOperational: boolean

  constructor(message: string, statusCode = 500, errors?: unknown[]) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.errors = errors
    this.isOperational = true
  }
}

export function notFound(resource = 'Resource'): AppError {
  return new AppError(`${resource} not found`, 404)
}

export function conflict(message: string): AppError {
  return new AppError(message, 409)
}

export function validationError(message: string, errors: unknown[] = []): AppError {
  return new AppError(message, 422, errors)
}

export function badRequest(message: string): AppError {
  return new AppError(message, 400)
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(message, 401)
}

export function forbidden(message = 'You do not have permission to perform this action'): AppError {
  return new AppError(message, 403)
}
