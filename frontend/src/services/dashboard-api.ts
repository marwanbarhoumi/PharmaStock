import type { ApiSuccess } from '@/types/auth'

import { apiClient } from '@/services/api'

export interface DashboardSummary {
  range: { from: string; to: string; timezone: string }
  inventory: {
    totalMedicines: number
    totalStockQuantity: number
    lowStockMedicines: number
    expiredBatches: number
    expiringSoonBatches: number
    expirationWarningDays: number
  }
  commerce: {
    totalSales: number
    totalPurchases: number
    revenue: number
    purchaseSpend: number
    profit: number
    profitNote: string
  }
}

export interface ChartPoint {
  date: string
  salesTotal: number
  salesCount: number
  purchasesTotal: number
  purchasesCount: number
}

export interface DashboardCharts {
  range: { from: string; to: string; timezone: string }
  series: ChartPoint[]
}

export interface DashboardRecent {
  recentSales: Array<{
    _id: string
    invoiceNumber: string
    total: number
    paymentMethod: string
    createdAt: string
    customerName?: string
    soldBy?: { firstName?: string; lastName?: string }
  }>
  recentMovements: Array<{
    _id: string
    type: string
    quantity: number
    createdAt: string
    medicine?: { name?: string; barcode?: string }
    batch?: { batchNumber?: string }
    performedBy?: { firstName?: string; lastName?: string }
  }>
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ReportType =
  | 'sales'
  | 'purchases'
  | 'stock'
  | 'low-stock'
  | 'expiration'
  | 'profit'

function dateParams(from?: string, to?: string) {
  const params: Record<string, string> = {}
  if (from) params.from = from
  if (to) params.to = to
  return params
}

export async function fetchDashboardSummary(from?: string, to?: string) {
  const response = await apiClient.get<ApiSuccess<DashboardSummary>>(
    '/dashboard/summary',
    { params: dateParams(from, to) },
  )
  return response.data.data
}

export async function fetchDashboardCharts(from?: string, to?: string) {
  const response = await apiClient.get<ApiSuccess<DashboardCharts>>(
    '/dashboard/charts',
    { params: dateParams(from, to) },
  )
  return response.data.data
}

export async function fetchDashboardRecent() {
  const response = await apiClient.get<ApiSuccess<DashboardRecent>>(
    '/dashboard/recent',
  )
  return response.data.data
}

export async function fetchReport(
  type: ReportType,
  params: {
    from?: string
    to?: string
    page?: number
    limit?: number
    search?: string
  },
) {
  const response = await apiClient.get<
    ApiSuccess<unknown> & { pagination?: PaginationMeta }
  >(`/reports/${type}`, { params })
  return {
    data: response.data.data,
    pagination: response.data.pagination,
    message: response.data.message,
  }
}

export async function downloadReportCsv(
  type: ReportType,
  from?: string,
  to?: string,
) {
  const response = await apiClient.get<Blob>('/reports/export', {
    params: { type, format: 'csv', ...dateParams(from, to) },
    responseType: 'blob',
  })

  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = /filename="?([^"]+)"?/.exec(disposition)
  const filename = match?.[1] ?? `${type}-report.csv`

  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
