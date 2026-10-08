import { loadEnv } from '../config/env.js'
import { Medicine } from '../models/index.js'
import { AppError, notFound } from '../utils/app-error.js'

interface CatalogMedicineResponse {
  data?: {
    _id?: string
    isActive?: boolean
  }
}

/**
 * Asserts that a medicine exists and is active.
 * Uses the Medicine Service internal catalog when MEDICINE_SERVICE_URL is set,
 * otherwise a read-only lookup on the shared `medicines` collection.
 */
export async function assertMedicineActive(medicineId: string): Promise<void> {
  const baseUrl = loadEnv().MEDICINE_SERVICE_URL

  if (!baseUrl) {
    const medicine = await Medicine.findById(medicineId).select('_id isActive')
    if (!medicine || medicine.isActive === false) {
      throw notFound('Medicine')
    }
    return
  }

  let response: Response
  try {
    response = await fetch(
      `${baseUrl}/internal/catalog/medicines/${encodeURIComponent(medicineId)}`,
    )
  } catch (error) {
    console.error('[inventory] Medicine Service unreachable', error)
    throw new AppError('Medicine Service unavailable', 503)
  }

  if (response.status === 404 || response.status === 400 || response.status === 422) {
    throw notFound('Medicine')
  }
  if (!response.ok) {
    throw new AppError('Medicine Service unavailable', 503)
  }

  const body = (await response.json()) as CatalogMedicineResponse
  if (!body.data || body.data.isActive === false) {
    throw notFound('Medicine')
  }
}
