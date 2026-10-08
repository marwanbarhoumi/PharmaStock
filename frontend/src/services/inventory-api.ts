import type { ApiSuccess } from '@/types/auth'
import type { PaginationMeta } from '@/services/dashboard-api'
import { apiClient } from '@/services/api'

export type { PaginationMeta }

/** Matches backend `paginationQuerySchema` max limit. */
export const API_LIST_LIMIT_MAX = 100

export interface NamedRef {
  _id: string
  name?: string
  phone?: string
  email?: string
  barcode?: string
  unit?: string
}

export interface Category {
  _id: string
  name: string
  description?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Supplier {
  _id: string
  name: string
  phone?: string
  email?: string
  address?: string
  contactPerson?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Medicine {
  _id: string
  name: string
  genericName?: string
  description?: string
  category: string | NamedRef
  laboratory?: string
  barcode?: string
  purchasePrice: number
  sellingPrice: number
  minimumStock: number
  unit: string
  supplier?: string | NamedRef | null
  image?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  batches?: Batch[]
  totalQuantity?: number
}

export interface Batch {
  _id: string
  medicine: string | NamedRef
  batchNumber: string
  quantity: number
  purchasePrice: number
  expirationDate: string
  receivedDate?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface StockOverviewRow {
  _id: string
  name: string
  genericName?: string
  barcode?: string
  unit?: string
  minimumStock: number
  totalQuantity: number
  batchCount: number
  nearestExpiration?: string
  isLowStock: boolean
  category?: NamedRef
  supplier?: NamedRef
}

export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT'

export interface StockMovement {
  _id: string
  medicine?: NamedRef
  batch?: { _id?: string; batchNumber?: string; expirationDate?: string }
  type: StockMovementType
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason?: string
  referenceType?: string
  referenceId?: string | null
  performedBy?: { firstName?: string; lastName?: string; email?: string }
  createdAt: string
}

export interface Paginated<T> {
  data: T
  pagination?: PaginationMeta
  message?: string
}

async function getPaginated<T>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<Paginated<T>> {
  const response = await apiClient.get<ApiSuccess<T> & { pagination?: PaginationMeta }>(
    url,
    { params },
  )
  return {
    data: response.data.data,
    pagination: response.data.pagination,
    message: response.data.message,
  }
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

/* Categories */
export async function listCategories(params?: Record<string, string | number | boolean | undefined>) {
  return getPaginated<Category[]>('/categories', cleanParams(params))
}

export async function getCategory(id: string) {
  const response = await apiClient.get<ApiSuccess<Category>>(`/categories/${id}`)
  return response.data.data
}

export async function createCategory(body: {
  name: string
  description?: string
  isActive?: boolean
}) {
  const response = await apiClient.post<ApiSuccess<Category>>('/categories', body)
  return response.data.data
}

export async function updateCategory(
  id: string,
  body: Partial<{ name: string; description: string; isActive: boolean }>,
) {
  const response = await apiClient.put<ApiSuccess<Category>>(`/categories/${id}`, body)
  return response.data.data
}

export async function deleteCategory(id: string) {
  const response = await apiClient.delete<ApiSuccess<Category>>(`/categories/${id}`)
  return response.data.data
}

/* Suppliers */
export async function listSuppliers(params?: Record<string, string | number | boolean | undefined>) {
  return getPaginated<Supplier[]>('/suppliers', cleanParams(params))
}

export async function getSupplier(id: string) {
  const response = await apiClient.get<ApiSuccess<Supplier>>(`/suppliers/${id}`)
  return response.data.data
}

export async function createSupplier(body: {
  name: string
  phone?: string
  email?: string
  address?: string
  contactPerson?: string
  isActive?: boolean
}) {
  const response = await apiClient.post<ApiSuccess<Supplier>>('/suppliers', body)
  return response.data.data
}

export async function updateSupplier(
  id: string,
  body: Partial<{
    name: string
    phone: string
    email: string
    address: string
    contactPerson: string
    isActive: boolean
  }>,
) {
  const response = await apiClient.put<ApiSuccess<Supplier>>(`/suppliers/${id}`, body)
  return response.data.data
}

export async function deleteSupplier(id: string) {
  const response = await apiClient.delete<ApiSuccess<Supplier>>(`/suppliers/${id}`)
  return response.data.data
}

/* Medicines */
export async function listMedicines(params?: Record<string, string | number | boolean | undefined>) {
  return getPaginated<Medicine[]>('/medicines', cleanParams(params))
}

export async function getMedicine(id: string) {
  const response = await apiClient.get<ApiSuccess<Medicine>>(`/medicines/${id}`)
  return response.data.data
}

export async function getMedicineByBarcode(barcode: string) {
  const response = await apiClient.get<ApiSuccess<Medicine>>(
    `/medicines/barcode/${encodeURIComponent(barcode)}`,
  )
  return response.data.data
}

export async function createMedicine(body: {
  name: string
  genericName?: string
  description?: string
  category: string
  laboratory?: string
  barcode?: string
  purchasePrice: number
  sellingPrice: number
  minimumStock?: number
  unit?: string
  supplier?: string | null
  image?: string
  isActive?: boolean
}) {
  const response = await apiClient.post<ApiSuccess<Medicine>>('/medicines', body)
  return response.data.data
}

export async function updateMedicine(
  id: string,
  body: Partial<{
    name: string
    genericName: string
    description: string
    category: string
    laboratory: string
    barcode: string
    purchasePrice: number
    sellingPrice: number
    minimumStock: number
    unit: string
    supplier: string | null
    image: string
    isActive: boolean
  }>,
) {
  const response = await apiClient.put<ApiSuccess<Medicine>>(`/medicines/${id}`, body)
  return response.data.data
}

export async function deleteMedicine(id: string) {
  const response = await apiClient.delete<ApiSuccess<Medicine>>(`/medicines/${id}`)
  return response.data.data
}

/* Batches */
export async function listBatches(params?: Record<string, string | number | boolean | undefined>) {
  return getPaginated<Batch[]>('/batches', cleanParams(params))
}

export async function getBatch(id: string) {
  const response = await apiClient.get<ApiSuccess<Batch>>(`/batches/${id}`)
  return response.data.data
}

export async function createBatch(body: {
  medicine: string
  batchNumber: string
  quantity: number
  purchasePrice: number
  expirationDate: string
  receivedDate?: string
  isActive?: boolean
}) {
  const response = await apiClient.post<ApiSuccess<Batch>>('/batches', body)
  return response.data.data
}

export async function updateBatch(
  id: string,
  body: Partial<{
    medicine: string
    batchNumber: string
    quantity: number
    purchasePrice: number
    expirationDate: string
    receivedDate: string
    isActive: boolean
  }>,
) {
  const response = await apiClient.put<ApiSuccess<Batch>>(`/batches/${id}`, body)
  return response.data.data
}

export async function deleteBatch(id: string) {
  const response = await apiClient.delete<ApiSuccess<Batch>>(`/batches/${id}`)
  return response.data.data
}

/* Stock */
export async function listStockOverview(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return getPaginated<StockOverviewRow[]>('/stock', cleanParams(params))
}

export async function getMedicineStock(medicineId: string) {
  const response = await apiClient.get<
    ApiSuccess<{
      medicine: Medicine
      totalQuantity: number
      isLowStock: boolean
      batches: Batch[]
    }>
  >(`/stock/${medicineId}`)
  return response.data.data
}

export async function listStockMovements(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return getPaginated<StockMovement[]>('/stock/movements', cleanParams(params))
}

export async function applyStockMovement(body: {
  medicineId: string
  batchId: string
  type: StockMovementType
  quantity: number
  reason?: string
  referenceType?: string
  referenceId?: string | null
}) {
  const response = await apiClient.post<
    ApiSuccess<{
      movement: StockMovement & { id?: string }
      batch: { id: string; batchNumber: string; quantity: number }
      usedTransaction: boolean
    }>
  >('/stock/movements', body)
  return response.data.data
}

export async function allocateFefo(body: { medicineId: string; quantity: number }) {
  const response = await apiClient.post<
    ApiSuccess<{
      medicineId: string
      requestedQuantity: number
      allocatedQuantity: number
      allocations: Array<{
        batchId: string
        batchNumber: string
        expirationDate: string
        availableQuantity: number
        allocatedQuantity: number
      }>
    }>
  >('/stock/fefo/allocate', body)
  return response.data.data
}
