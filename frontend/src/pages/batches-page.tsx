import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import {
  createBatch,
  deleteBatch,
  listBatches,
  listMedicines,
  updateBatch,
  type Batch,
  type Medicine,
  type PaginationMeta,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'
import { namedRef, useFormatters } from '@/utils/format'

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

type BatchForm = {
  medicine: string
  batchNumber: string
  quantity: string
  purchasePrice: string
  expirationDate: string
  receivedDate: string
}

const emptyForm: BatchForm = {
  medicine: '',
  batchNumber: '',
  quantity: '',
  purchasePrice: '',
  expirationDate: '',
  receivedDate: '',
}

function refId(value: string | { _id?: string } | null | undefined) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value._id ?? ''
}

function toDateInput(value?: string) {
  if (!value) return ''
  return value.slice(0, 10)
}

export function BatchesPage() {
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()
  const { money, date } = useFormatters()

  const [items, setItems] = useState<Batch[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [medicineFilter, setMedicineFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
  const [form, setForm] = useState<BatchForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadMedicines() {
      try {
        const result = await listMedicines({ limit: 100, page: 1 })
        if (!cancelled) setMedicines(result.data)
      } catch {
        if (!cancelled) setMedicines([])
      }
    }
    void loadMedicines()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listBatches({
        page,
        limit: 10,
        search: search.trim() || undefined,
        medicine: medicineFilter || undefined,
      })
      setItems(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(getErrorMessage(err, t('batches.loadFailed')))
      setItems([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, search, medicineFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({
      ...emptyForm,
      medicine: medicines[0]?._id ?? '',
    })
    setFormOpen(true)
    setSuccess(null)
    setError(null)
  }

  function openEdit(batch: Batch) {
    setEditing(batch)
    setForm({
      medicine: refId(batch.medicine),
      batchNumber: batch.batchNumber,
      quantity: String(batch.quantity ?? ''),
      purchasePrice: String(batch.purchasePrice ?? ''),
      expirationDate: toDateInput(batch.expirationDate),
      receivedDate: toDateInput(batch.receivedDate),
    })
    setFormOpen(true)
    setSuccess(null)
    setError(null)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.medicine || !form.batchNumber.trim() || !form.expirationDate) {
      setError(t('common.required'))
      return
    }

    const quantity = Number(form.quantity)
    const purchasePrice = Number(form.purchasePrice)
    if (Number.isNaN(quantity) || Number.isNaN(purchasePrice)) {
      setError(t('common.required'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const body = {
        medicine: form.medicine,
        batchNumber: form.batchNumber.trim(),
        quantity,
        purchasePrice,
        expirationDate: form.expirationDate,
        receivedDate: form.receivedDate || undefined,
      }
      if (editing) {
        await updateBatch(editing._id, body)
      } else {
        await createBatch(body)
      }
      setSuccess(t('batches.saved'))
      closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('batches.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(batch: Batch) {
    if (!window.confirm(t('common.confirmDelete'))) return

    setDeletingId(batch._id)
    setError(null)
    setSuccess(null)
    try {
      await deleteBatch(batch._id)
      setSuccess(t('batches.deleted'))
      if (editing?._id === batch._id) closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('batches.deleteFailed')))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('batches.title')}
        description={t('batches.subtitle')}
        actions={
          canWriteInventory ? (
            <Button type="button" size="sm" onClick={openCreate}>
              {t('batches.create')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[14rem] flex-1 gap-1">
          <Label htmlFor="batch-search">{t('common.search')}</Label>
          <Input
            id="batch-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
          />
        </div>
        <div className="grid min-w-[14rem] gap-1">
          <Label htmlFor="batch-medicine-filter">{t('common.medicine')}</Label>
          <select
            id="batch-medicine-filter"
            value={medicineFilter}
            onChange={(event) => {
              setMedicineFilter(event.target.value)
              setPage(1)
            }}
            className={selectClassName}
          >
            <option value="">{t('common.all')}</option>
            {medicines.map((medicine) => (
              <option key={medicine._id} value={medicine._id}>
                {medicine.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {success ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {formOpen && canWriteInventory ? (
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-4 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-lg font-medium">
            {editing ? t('batches.edit') : t('batches.create')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="batch-medicine">{t('common.medicine')}</Label>
              <select
                id="batch-medicine"
                value={form.medicine}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, medicine: event.target.value }))
                }
                className={selectClassName}
                required
              >
                <option value="">{t('common.emDash')}</option>
                {medicines.map((medicine) => (
                  <option key={medicine._id} value={medicine._id}>
                    {medicine.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-number">{t('batches.batchNumber')}</Label>
              <Input
                id="batch-number"
                value={form.batchNumber}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, batchNumber: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-quantity">{t('common.quantity')}</Label>
              <Input
                id="batch-quantity"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, quantity: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-price">{t('batches.purchasePrice')}</Label>
              <Input
                id="batch-price"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, purchasePrice: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-expiration">{t('batches.expirationDate')}</Label>
              <Input
                id="batch-expiration"
                type="date"
                value={form.expirationDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expirationDate: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-received">{t('batches.receivedDate')}</Label>
              <Input
                id="batch-received"
                type="date"
                value={form.receivedDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, receivedDate: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('batches.empty')}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('batches.batchNumber')}</th>
                <th className="px-3 py-2 font-medium">{t('common.medicine')}</th>
                <th className="px-3 py-2 font-medium">{t('common.quantity')}</th>
                <th className="px-3 py-2 font-medium">{t('batches.purchasePrice')}</th>
                <th className="px-3 py-2 font-medium">{t('batches.expirationDate')}</th>
                <th className="px-3 py-2 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((batch) => (
                <tr key={batch._id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{batch.batchNumber}</td>
                  <td className="px-3 py-2">{namedRef(batch.medicine)}</td>
                  <td className="px-3 py-2">{batch.quantity}</td>
                  <td className="px-3 py-2">{money(batch.purchasePrice)}</td>
                  <td className="px-3 py-2">{date(batch.expirationDate)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/batches/${batch._id}`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                      >
                        {t('common.details')}
                      </Link>
                      {canWriteInventory ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(batch)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingId === batch._id}
                            onClick={() => void onDelete(batch)}
                          >
                            {deletingId === batch._id
                              ? t('common.deleting')
                              : t('common.delete')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <PaginationBar pagination={pagination} page={page} onPageChange={setPage} />
    </section>
  )
}
