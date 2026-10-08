import type { Response } from 'express'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface SuccessOptions<T> {
  res: Response
  statusCode?: number
  message: string
  data?: T
  pagination?: PaginationMeta
}

export function sendSuccess<T>({
  res,
  statusCode = 200,
  message,
  data,
  pagination,
}: SuccessOptions<T>): void {
  const body: Record<string, unknown> = {
    success: true,
    message,
  }

  if (data !== undefined) {
    body.data = data
  }

  if (pagination) {
    body.pagination = pagination
  }

  res.status(statusCode).json(body)
}

export function sendCreated<T>(
  res: Response,
  message: string,
  data: T,
): void {
  sendSuccess({ res, statusCode: 201, message, data })
}
