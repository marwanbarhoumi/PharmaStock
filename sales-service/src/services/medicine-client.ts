/**
 * Internal HTTP client for the Medicine Service catalog (owner of medicines).
 */
import { loadEnv } from '../config/env.js'
import { notFound } from '../utils/app-error.js'
import { callService, ServiceCallError } from './internal-http.js'

export interface CatalogMedicine {
  _id: string
  name: string
  barcode?: string
  unit?: string
  sellingPrice: number
  isActive?: boolean
}

/** Returns the medicine, or null when the catalog reports 404. */
export async function fetchMedicine(id: string): Promise<CatalogMedicine | null> {
  try {
    return await callService<CatalogMedicine>({
      service: 'Medicine Service',
      baseUrl: `${loadEnv().MEDICINE_SERVICE_URL}/internal/catalog`,
      method: 'GET',
      path: `/medicines/${encodeURIComponent(id)}`,
    })
  } catch (error) {
    if (error instanceof ServiceCallError && error.statusCode === 404) {
      return null
    }
    throw error
  }
}

/** Sale validation: same rule as the monolith (missing or inactive → 404 Medicine not found). */
export async function getSellableMedicine(id: string): Promise<CatalogMedicine> {
  const medicine = await fetchMedicine(id)
  if (!medicine || medicine.isActive === false) {
    throw notFound('Medicine')
  }
  return medicine
}
