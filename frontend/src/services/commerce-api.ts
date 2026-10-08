import type { ApiSuccess } from '@/types/auth'
import type { PaginationMeta } from '@/services/dashboard-api'
import { apiClient } from '@/services/api'

export type SaleStatus = 'COMPLETED' | 'CANCELLED'
export type PurchaseStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER'

export interface SaleItem {
  _id?: string
  medicine?: { _id?: string; name?: string; barcode?: string; unit?: string; sellingPrice?: number }
  batch?: {
    _id?: string
    batchNumber?: string
    expirationDate?: string
    quantity?: number
  }
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Sale {
  _id: string
  invoiceNumber: string
  customerName?: string
  customerPhone?: string
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  status: SaleStatus
  soldBy?: { firstName?: string; lastName?: string; email?: string; role?: string }
  createdAt: string
  updatedAt?: string
}

export interface PurchaseItem {
  _id?: string
  medicine?: { _id?: string; name?: string; barcode?: string; unit?: string }
  batch?: { _id?: string; batchNumber?: string; expirationDate?: string; quantity?: number }
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Purchase {
  _id: string
  purchaseNumber: string
  supplier?: { _id?: string; name?: string; phone?: string; email?: string }
  items: PurchaseItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  status: PurchaseStatus
  purchasedBy?: { firstName?: string; lastName?: string; email?: string }
  purchaseDate: string
  createdAt?: string
  updatedAt?: string
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

async function getPaginated<T>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const response = await apiClient.get<ApiSuccess<T> & { pagination?: PaginationMeta }>(
    url,
    { params: cleanParams(params) },
  )
  return {
    data: response.data.data,
    pagination: response.data.pagination,
    message: response.data.message,
  }
}

export async function listSales(params?: Record<string, string | number | boolean | undefined>) {
  return getPaginated<Sale[]>('/sales', params)
}

export async function getSale(id: string) {
  const response = await apiClient.get<ApiSuccess<Sale>>(`/sales/${id}`)
  return response.data.data
}

export async function createSale(body: {
  customerName?: string
  customerPhone?: string
  paymentMethod?: PaymentMethod
  discount?: number
  tax?: number
  items: Array<{ medicineId: string; quantity: number }>
}) {
  const response = await apiClient.post<ApiSuccess<Sale>>('/sales', body)
  return response.data.data
}

export async function cancelSale(id: string) {
  const response = await apiClient.post<ApiSuccess<Sale>>(`/sales/${id}/cancel`)
  return response.data.data
}

export async function listPurchases(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return getPaginated<Purchase[]>('/purchases', params)
}

export async function getPurchase(id: string) {
  const response = await apiClient.get<ApiSuccess<Purchase>>(`/purchases/${id}`)
  return response.data.data
}

export async function createPurchase(body: {
  supplierId: string
  discount?: number
  tax?: number
  receiveNow?: boolean
  items: Array<{
    medicineId: string
    quantity: number
    unitPrice: number
    batchNumber: string
    expirationDate: string
  }>
}) {
  const response = await apiClient.post<ApiSuccess<Purchase>>('/purchases', body)
  return response.data.data
}

export async function receivePurchase(id: string) {
  const response = await apiClient.post<ApiSuccess<Purchase>>(`/purchases/${id}/receive`)
  return response.data.data
}

export async function cancelPurchase(id: string) {
  const response = await apiClient.post<ApiSuccess<Purchase>>(`/purchases/${id}/cancel`)
  return response.data.data
}
