/**
 * Rebuilds the monolith's nested populate output for sale items
 * (medicine 'name barcode [unit sellingPrice]', batch 'batchNumber expirationDate [quantity]')
 * from the owning services. A reference that no longer exists becomes null,
 * like populate; if an owner is unreachable the item keeps an `{ _id }` placeholder.
 */
import { fetchBatchReferences } from './inventory-client.js'
import { fetchMedicine, type CatalogMedicine } from './medicine-client.js'

type View = 'list' | 'detail'

interface SaleItemLike {
  medicine?: unknown
  batch?: unknown
  [key: string]: unknown
}

interface SaleLike {
  items?: unknown[]
  [key: string]: unknown
}

const MEDICINE_LOOKUP_CONCURRENCY = 10
const BATCH_REFERENCE_CHUNK = 500

function refId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function pickMedicine(medicine: CatalogMedicine, view: View) {
  const base = { _id: medicine._id, name: medicine.name, barcode: medicine.barcode }
  return view === 'detail'
    ? { ...base, unit: medicine.unit, sellingPrice: medicine.sellingPrice }
    : base
}

async function loadMedicines(ids: string[], view: View) {
  const result = new Map<string, unknown>()
  for (let i = 0; i < ids.length; i += MEDICINE_LOOKUP_CONCURRENCY) {
    const chunk = ids.slice(i, i + MEDICINE_LOOKUP_CONCURRENCY)
    const settled = await Promise.allSettled(chunk.map((id) => fetchMedicine(id)))
    settled.forEach((outcome, index) => {
      const id = chunk[index]!
      if (outcome.status === 'fulfilled') {
        result.set(id, outcome.value ? pickMedicine(outcome.value, view) : null)
      } else {
        console.warn(`[sale] medicine ${id} display fields unavailable`)
        result.set(id, { _id: id })
      }
    })
  }
  return result
}

async function loadBatches(ids: string[], view: View) {
  const result = new Map<string, unknown>()
  if (ids.length === 0) {
    return result
  }
  try {
    const batches = []
    for (let i = 0; i < ids.length; i += BATCH_REFERENCE_CHUNK) {
      batches.push(...(await fetchBatchReferences(ids.slice(i, i + BATCH_REFERENCE_CHUNK))))
    }
    const found = new Map(batches.map((batch) => [String(batch._id), batch]))
    for (const id of ids) {
      const batch = found.get(id)
      if (!batch) {
        result.set(id, null)
      } else {
        const base = {
          _id: batch._id,
          batchNumber: batch.batchNumber,
          expirationDate: batch.expirationDate,
        }
        result.set(id, view === 'detail' ? { ...base, quantity: batch.quantity } : base)
      }
    }
  } catch {
    console.warn('[sale] batch display fields unavailable')
    for (const id of ids) {
      result.set(id, { _id: id })
    }
  }
  return result
}

function resolve(found: Map<string, unknown>, id: string): unknown {
  return found.has(id) ? found.get(id) : { _id: id }
}

export async function hydrateSaleReferences<T extends SaleLike>(
  sales: T[],
  view: View,
): Promise<T[]> {
  const medicineIds = new Set<string>()
  const batchIds = new Set<string>()

  for (const sale of sales) {
    for (const item of (sale.items ?? []) as SaleItemLike[]) {
      const medicineId = refId(item.medicine)
      const batchId = refId(item.batch)
      if (medicineId) medicineIds.add(medicineId)
      if (batchId) batchIds.add(batchId)
    }
  }

  const [medicines, batches] = await Promise.all([
    loadMedicines([...medicineIds], view),
    loadBatches([...batchIds], view),
  ])

  return sales.map((sale) => ({
    ...sale,
    items: ((sale.items ?? []) as SaleItemLike[]).map((item) => {
      const medicineId = refId(item.medicine)
      const batchId = refId(item.batch)
      return {
        ...item,
        medicine: medicineId ? resolve(medicines, medicineId) : null,
        batch: batchId ? resolve(batches, batchId) : null,
      }
    }),
  }))
}
