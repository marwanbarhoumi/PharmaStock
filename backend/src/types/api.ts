export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  message: string
  data?: T
  pagination?: PaginationMeta
}

export interface ApiErrorResponse {
  success: false
  message: string
  errors?: unknown[]
}
