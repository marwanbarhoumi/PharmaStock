import type { ApiSuccess } from '@/types/auth'
import type { PaginationMeta } from '@/services/dashboard-api'
import { apiClient } from '@/services/api'

export interface AuditLogRow {
  _id: string
  action: string
  entity: string
  entityId?: string | null
  description?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  createdAt: string
  user?: {
    firstName?: string
    lastName?: string
    email?: string
    role?: string
  } | null
}

export async function listAuditLogs(
  params?: Record<string, string | number | boolean | undefined>,
) {
  const cleaned: Record<string, string | number | boolean> = {}
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue
      cleaned[key] = value
    }
  }
  const response = await apiClient.get<
    ApiSuccess<AuditLogRow[]> & { pagination?: PaginationMeta }
  >('/audit-logs', { params: cleaned })
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  }
}
