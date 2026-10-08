/**
 * Rebuilds the monolith's nested populate output for purchase items
 * (medicine 'name barcode [unit]', batch 'batchNumber expirationDate quantity [purchasePrice]')
 * from the owning services. A reference that no longer exists becomes null,
 * like populate; if an owner is unreachable the item keeps an `{ _id }` placeholder.
 */
import { fetchBatchReferences, type BatchReference } from './inventory-client.js'
import { fetchMedicine, type CatalogMedicine } from './medicine-client.js'

type View = 'list' | 'detail'

interface ItemLike {
  medicine?: unknown
  batch?: unknown
  [key: string]: unknown
}

interface PurchaseLike {
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
  return view === 'detail' ? { ...base, unit: medicine.unit } : base
}

function pickBatch(batch: BatchReference, view: View) {
  const base = {
    _id: batch._id,
    batchNumber: batch.batchNumber,
    expirationDate: batch.expirationDate,
    quantity: batch.quantity,
  }
  return view === 'detail' ? { ...base, purchasePrice: batch.purchasePrice } : base
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
        console.warn(`[purchase] medicine ${id} display fields unavailable`)
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
    const batches: BatchReference[] = []
    for (let i = 0; i < ids.length; i += BATCH_REFERENCE_CHUNK) {
      batches.push(...(await fetchBatchReferences(ids.slice(i, i + BATCH_REFERENCE_CHUNK))))
    }
    const found = new Map(batches.map((batch) => [String(batch._id), batch]))
    for (const id of ids) {
      const batch = found.get(id)
      result.set(id, batch ? pickBatch(batch, view) : null)
    }
  } catch {
    console.warn('[purchase] batch display fields unavailable')
    for (const id of ids) {
      result.set(id, { _id: id })
    }
  }
  return result
}

function resolve(found: Map<string, unknown>, id: string): unknown {
  return found.has(id) ? found.get(id) : { _id: id }
}

export async function hydratePurchaseReferences<T extends PurchaseLike>(
  purchases: T[],
  view: View,
): Promise<T[]> {
  const medicineIds = new Set<string>()
  const batchIds = new Set<string>()

  for (const purchase of purchases) {
    for (const item of (purchase.items ?? []) as ItemLike[]) {
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

  return purchases.map((purchase) => ({
    ...purchase,
    items: ((purchase.items ?? []) as ItemLike[]).map((item) => {
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
