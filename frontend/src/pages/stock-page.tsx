import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import type { TranslationKey } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  applyStockMovement,
  getMedicineStock,
  listMedicines,
  listStockMovements,
  listStockOverview,
  type Batch,
  type Medicine,
  type PaginationMeta,
  type StockMovement,
  type StockMovementType,
  type StockOverviewRow,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'
import { namedRef, useFormatters } from '@/utils/format'

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

const MANUAL_TYPES: StockMovementType[] = [
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN_IN',
  'RETURN_OUT',
]

const ALL_TYPES: StockMovementType[] = [
  'PURCHASE',
  'SALE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN_IN',
  'RETURN_OUT',
]

const TYPE_KEYS: Record<StockMovementType, TranslationKey> = {
  PURCHASE: 'stock.type.PURCHASE',
  SALE: 'stock.type.SALE',
  ADJUSTMENT_IN: 'stock.type.ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'stock.type.ADJUSTMENT_OUT',
  RETURN_IN: 'stock.type.RETURN_IN',
  RETURN_OUT: 'stock.type.RETURN_OUT',
}

type Tab = 'overview' | 'movements' | 'apply'

type MovementForm = {
  medicineId: string
  batchId: string
  type: StockMovementType
  quantity: string
  reason: string
}

const emptyMovementForm: MovementForm = {
  medicineId: '',
  batchId: '',
  type: 'ADJUSTMENT_IN',
  quantity: '',
  reason: '',
}

export function StockPage() {
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()
  const { date, dateTime } = useFormatters()

  const [tab, setTab] = useState<Tab>('overview')

  const [overview, setOverview] = useState<StockOverviewRow[]>([])
  const [overviewPagination, setOverviewPagination] = useState<PaginationMeta | undefined>()
  const [overviewPage, setOverviewPage] = useState(1)
  const [overviewSearch, setOverviewSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(true)

  const [movements, setMovements] = useState<StockMovement[]>([])
  const [movementsPagination, setMovementsPagination] = useState<PaginationMeta | undefined>()
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementTypeFilter, setMovementTypeFilter] = useState('')
  const [movementsLoading, setMovementsLoading] = useState(false)

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovementForm)
  const [savingMovement, setSavingMovement] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setError(null)
    try {
      const result = await listStockOverview({
        page: overviewPage,
        limit: 10,
        search: overviewSearch.trim() || undefined,
        lowStock: lowStockOnly ? true : undefined,
      })
      setOverview(result.data)
      setOverviewPagination(result.pagination)
    } catch (err) {
      setError(getErrorMessage(err, t('stock.loadFailed')))
      setOverview([])
      setOverviewPagination(undefined)
    } finally {
      setOverviewLoading(false)
    }
  }, [overviewPage, overviewSearch, lowStockOnly, t])

  const loadMovements = useCallback(async () => {
    setMovementsLoading(true)
    setError(null)
    try {
      const result = await listStockMovements({
        page: movementsPage,
        limit: 10,
        type: movementTypeFilter || undefined,
      })
      setMovements(result.data)
      setMovementsPagination(result.pagination)
    } catch (err) {
      setError(getErrorMessage(err, t('stock.loadFailed')))
      setMovements([])
      setMovementsPagination(undefined)
    } finally {
      setMovementsLoading(false)
    }
  }, [movementsPage, movementTypeFilter, t])

  useEffect(() => {
    if (tab === 'overview') void loadOverview()
  }, [tab, loadOverview])

  useEffect(() => {
    if (tab === 'movements') void loadMovements()
  }, [tab, loadMovements])

  useEffect(() => {
    let cancelled = false

    async function loadBatchesForMedicine() {
      if (!movementForm.medicineId) {
        setBatches([])
        setMovementForm((prev) => ({ ...prev, batchId: '' }))
        return
      }

      setLoadingBatches(true)
      try {
        const stock = await getMedicineStock(movementForm.medicineId)
        if (cancelled) return
        const nextBatches = stock.batches ?? []
        setBatches(nextBatches)
        setMovementForm((prev) => ({
          ...prev,
          batchId:
            prev.batchId && nextBatches.some((batch) => batch._id === prev.batchId)
              ? prev.batchId
              : (nextBatches[0]?._id ?? ''),
        }))
      } catch (err) {
        if (!cancelled) {
          setBatches([])
          setMovementForm((prev) => ({ ...prev, batchId: '' }))
          setError(getErrorMessage(err, t('stock.loadFailed')))
        }
      } finally {
        if (!cancelled) setLoadingBatches(false)
      }
    }

    if (tab === 'apply') void loadBatchesForMedicine()

    return () => {
      cancelled = true
    }
  }, [movementForm.medicineId, tab, t])

  async function onApplyMovement(event: FormEvent) {
    event.preventDefault()
    if (!movementForm.medicineId || !movementForm.batchId || !movementForm.quantity) {
      setError(t('common.required'))
      return
    }

    const quantity = Number(movementForm.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError(t('common.required'))
      return
    }

    setSavingMovement(true)
    setError(null)
    setSuccess(null)
    try {
      await applyStockMovement({
        medicineId: movementForm.medicineId,
        batchId: movementForm.batchId,
        type: movementForm.type,
        quantity,
        reason: movementForm.reason.trim() || undefined,
      })
      setSuccess(t('stock.movementSaved'))
      setMovementForm((prev) => ({
        ...prev,
        quantity: '',
        reason: '',
      }))
      if (movementForm.medicineId) {
        const stock = await getMedicineStock(movementForm.medicineId)
        setBatches(stock.batches ?? [])
      }
    } catch (err) {
      setError(getErrorMessage(err, t('stock.movementFailed')))
    } finally {
      setSavingMovement(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string; visible?: boolean }> = [
    { id: 'overview', label: t('stock.overview') },
    { id: 'movements', label: t('stock.movements') },
    { id: 'apply', label: t('stock.applyMovement'), visible: canWriteInventory },
  ]

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader title={t('stock.title')} description={t('stock.subtitle')} />

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((item) => item.visible !== false)
          .map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={tab === item.id ? 'default' : 'outline'}
              onClick={() => {
                setTab(item.id)
                setError(null)
                setSuccess(null)
              }}
            >
              {item.label}
            </Button>
          ))}
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

      {tab === 'overview' ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-[14rem] flex-1 gap-1">
              <Label htmlFor="stock-search">{t('common.search')}</Label>
              <Input
                id="stock-search"
                value={overviewSearch}
                onChange={(event) => {
                  setOverviewSearch(event.target.value)
                  setOverviewPage(1)
                }}
                placeholder={t('common.search')}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(event) => {
                  setLowStockOnly(event.target.checked)
                  setOverviewPage(1)
                }}
                className="size-4 rounded border border-input"
              />
              {t('stock.lowStockOnly')}
            </label>
          </div>

          {overviewLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : null}

          {!overviewLoading && overview.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('stock.empty')}</p>
          ) : null}

          {!overviewLoading && overview.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('common.name')}</th>
                    <th className="px-3 py-2 font-medium">{t('medicines.category')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.totalQuantity')}</th>
                    <th className="px-3 py-2 font-medium">{t('medicines.minimumStock')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.batchCount')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.nearestExpiration')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.isLowStock')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map((row) => (
                    <tr key={row._id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">
                        <Link
                          to={`/medicines/${row._id}`}
                          className="text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{namedRef(row.category)}</td>
                      <td className="px-3 py-2">{row.totalQuantity}</td>
                      <td className="px-3 py-2">{row.minimumStock}</td>
                      <td className="px-3 py-2">{row.batchCount}</td>
                      <td className="px-3 py-2">{date(row.nearestExpiration)}</td>
                      <td className="px-3 py-2">
                        {row.isLowStock ? t('common.yes') : t('common.no')}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/medicines/${row._id}`}
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                        >
                          {t('common.details')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <PaginationBar
            pagination={overviewPagination}
            page={overviewPage}
            onPageChange={setOverviewPage}
          />
        </>
      ) : null}

      {tab === 'movements' ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-[14rem] gap-1">
              <Label htmlFor="movement-type-filter">{t('stock.type')}</Label>
              <select
                id="movement-type-filter"
                value={movementTypeFilter}
                onChange={(event) => {
                  setMovementTypeFilter(event.target.value)
                  setMovementsPage(1)
                }}
                className={selectClassName}
              >
                <option value="">{t('common.all')}</option>
                {ALL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(TYPE_KEYS[type])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {movementsLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : null}

          {!movementsLoading && movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('stock.movementsEmpty')}</p>
          ) : null}

          {!movementsLoading && movements.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('common.medicine')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.batch')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.type')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.quantity')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.previous')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.new')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.reason')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement._id} className="border-t border-border">
                      <td className="px-3 py-2">{namedRef(movement.medicine)}</td>
                      <td className="px-3 py-2">
                        {movement.batch?.batchNumber || t('common.emDash')}
                      </td>
                      <td className="px-3 py-2">{t(TYPE_KEYS[movement.type])}</td>
                      <td className="px-3 py-2">{movement.quantity}</td>
                      <td className="px-3 py-2">{movement.previousQuantity}</td>
                      <td className="px-3 py-2">{movement.newQuantity}</td>
                      <td className="px-3 py-2">
                        {movement.reason || t('common.emDash')}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {dateTime(movement.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <PaginationBar
            pagination={movementsPagination}
            page={movementsPage}
            onPageChange={setMovementsPage}
          />
        </>
      ) : null}

      {tab === 'apply' && canWriteInventory ? (
        <form
          onSubmit={(event) => void onApplyMovement(event)}
          className="space-y-4 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-lg font-medium">{t('stock.applyMovement')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="movement-medicine">{t('common.medicine')}</Label>
              <select
                id="movement-medicine"
                value={movementForm.medicineId}
                onChange={(event) =>
                  setMovementForm((prev) => ({
                    ...prev,
                    medicineId: event.target.value,
                    batchId: '',
                  }))
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
              <Label htmlFor="movement-batch">{t('stock.batch')}</Label>
              <select
                id="movement-batch"
                value={movementForm.batchId}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, batchId: event.target.value }))
                }
                className={selectClassName}
                required
                disabled={!movementForm.medicineId || loadingBatches}
              >
                <option value="">{t('common.emDash')}</option>
                {batches.map((batch) => (
                  <option key={batch._id} value={batch._id}>
                    {batch.batchNumber} ({batch.quantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-type">{t('stock.type')}</Label>
              <select
                id="movement-type"
                value={movementForm.type}
                onChange={(event) =>
                  setMovementForm((prev) => ({
                    ...prev,
                    type: event.target.value as StockMovementType,
                  }))
                }
                className={selectClassName}
                required
              >
                {MANUAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(TYPE_KEYS[type])}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-quantity">{t('common.quantity')}</Label>
              <Input
                id="movement-quantity"
                type="number"
                min="1"
                step="1"
                value={movementForm.quantity}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="movement-reason">{t('stock.reason')}</Label>
              <Input
                id="movement-reason"
                value={movementForm.reason}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, reason: event.target.value }))
                }
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={savingMovement || loadingBatches}>
            {savingMovement ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      ) : null}
    </section>
  )
}
