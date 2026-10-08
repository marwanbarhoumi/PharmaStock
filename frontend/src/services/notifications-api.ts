import type { ApiSuccess } from '@/types/auth'
import type { PaginationMeta } from '@/services/dashboard-api'
import { apiClient } from '@/services/api'
import {
  normalizeAlertsSnapshot,
  type AlertsApiPayload,
  type AlertsSnapshot,
} from '@/lib/alerts'

export type { AlertsSnapshot, ExpirationAlertItem, LowStockAlertItem } from '@/lib/alerts'
export { normalizeAlertsSnapshot } from '@/lib/alerts'

export type NotificationType =
  | 'LOW_STOCK'
  | 'EXPIRATION_WARNING'
  | 'EXPIRED_MEDICINE'
  | 'SYSTEM'
  | 'OTHER'

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface AppNotification {
  _id: string
  type: NotificationType
  title: string
  message: string
  severity: NotificationSeverity
  isRead: boolean
  relatedMedicine?: { _id?: string; name?: string; barcode?: string }
  relatedBatch?: {
    _id?: string
    batchNumber?: string
    expirationDate?: string
    quantity?: number
  }
  createdAt: string
}

function cleanParams(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return undefined
  const next: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    next[key] = value
  }
  return next
}

export async function listNotifications(
  params?: Record<string, string | number | boolean | undefined>,
) {
  const response = await apiClient.get<
    ApiSuccess<AppNotification[]> & { pagination?: PaginationMeta }
  >('/notifications', { params: cleanParams(params) })
  return {
    data: Array.isArray(response.data.data) ? response.data.data : [],
    pagination: response.data.pagination,
  }
}

export async function getUnreadNotificationCount() {
  const response = await apiClient.get<ApiSuccess<{ count: number }>>(
    '/notifications/unread-count',
  )
  return response.data.data?.count ?? 0
}

export async function markNotificationRead(id: string) {
  const response = await apiClient.patch<ApiSuccess<AppNotification>>(
    `/notifications/${id}/read`,
  )
  return response.data.data
}

export async function markAllNotificationsRead() {
  const response = await apiClient.patch<ApiSuccess<{ modifiedCount: number }>>(
    '/notifications/read-all',
  )
  return response.data.data
}

export async function fetchAlerts(): Promise<AlertsSnapshot> {
  const response = await apiClient.get<ApiSuccess<AlertsApiPayload>>('/alerts')
  return normalizeAlertsSnapshot(response.data.data)
}

export async function runAlertCheck() {
  const response = await apiClient.post<
    ApiSuccess<{
      checkedAt: string
      warningDays: number
      expirationAlerts: number
      lowStockAlerts: number
      notificationsCreated: number
      lowStockResolved: number
      recipientCount: number
    }>
  >('/alerts/check')
  return response.data.data
}
