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
  createMedicine,
  deleteMedicine,
  listCategories,
  listMedicines,
  listSuppliers,
  updateMedicine,
  type Category,
  type Medicine,
  type PaginationMeta,
  type Supplier,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'
import { namedRef, useFormatters } from '@/utils/format'

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

type MedicineForm = {
  name: string
  genericName: string
  description: string
  category: string
  laboratory: string
  barcode: string
  purchasePrice: string
  sellingPrice: string
  minimumStock: string
  unit: string
  supplier: string
}

const emptyForm: MedicineForm = {
  name: '',
  genericName: '',
  description: '',
  category: '',
  laboratory: '',
  barcode: '',
  purchasePrice: '',
  sellingPrice: '',
  minimumStock: '0',
  unit: 'unit',
  supplier: '',
}

function refId(value: string | { _id?: string } | null | undefined) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value._id ?? ''
}

export function MedicinesPage() {
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()
  const { money } = useFormatters()

  const [items, setItems] = useState<Medicine[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Medicine | null>(null)
  const [form, setForm] = useState<MedicineForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadLookups() {
      try {
        const [cats, sups] = await Promise.all([
          listCategories({ limit: 100, page: 1 }),
          listSuppliers({ limit: 100, page: 1 }),
        ])
        if (cancelled) return
        setCategories(cats.data)
        setSuppliers(sups.data)
      } catch {
        if (!cancelled) {
          setCategories([])
          setSuppliers([])
        }
      }
    }
    void loadLookups()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listMedicines({
        page,
        limit: 10,
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
      })
      setItems(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(getErrorMessage(err, t('medicines.loadFailed')))
      setItems([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({
      ...emptyForm,
      category: categories[0]?._id ?? '',
    })
    setFormOpen(true)
    setSuccess(null)
    setError(null)
  }

  function openEdit(medicine: Medicine) {
    setEditing(medicine)
    setForm({
      name: medicine.name,
      genericName: medicine.genericName ?? '',
      description: medicine.description ?? '',
      category: refId(medicine.category),
      laboratory: medicine.laboratory ?? '',
      barcode: medicine.barcode ?? '',
      purchasePrice: String(medicine.purchasePrice ?? ''),
      sellingPrice: String(medicine.sellingPrice ?? ''),
      minimumStock: String(medicine.minimumStock ?? 0),
      unit: medicine.unit || 'unit',
      supplier: refId(medicine.supplier),
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
    if (!form.name.trim() || !form.category) {
      setError(t('common.required'))
      return
    }

    const purchasePrice = Number(form.purchasePrice)
    const sellingPrice = Number(form.sellingPrice)
    const minimumStock = Number(form.minimumStock)

    if (
      Number.isNaN(purchasePrice) ||
      Number.isNaN(sellingPrice) ||
      Number.isNaN(minimumStock)
    ) {
      setError(t('common.required'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const body = {
        name: form.name.trim(),
        genericName: form.genericName.trim() || undefined,
        description: form.description.trim() || undefined,
        category: form.category,
        laboratory: form.laboratory.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        purchasePrice,
        sellingPrice,
        minimumStock,
        unit: form.unit.trim() || 'unit',
        supplier: form.supplier || null,
      }
      if (editing) {
        await updateMedicine(editing._id, body)
      } else {
        await createMedicine(body)
      }
      setSuccess(t('medicines.saved'))
      closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('medicines.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(medicine: Medicine) {
    if (!window.confirm(t('common.confirmDelete'))) return

    setDeletingId(medicine._id)
    setError(null)
    setSuccess(null)
    try {
      await deleteMedicine(medicine._id)
      setSuccess(t('medicines.deleted'))
      if (editing?._id === medicine._id) closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('medicines.deleteFailed')))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('medicines.title')}
        description={t('medicines.subtitle')}
        actions={
          canWriteInventory ? (
            <Button type="button" size="sm" onClick={openCreate}>
              {t('medicines.create')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[14rem] flex-1 gap-1">
          <Label htmlFor="medicine-search">{t('common.search')}</Label>
          <Input
            id="medicine-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
          />
        </div>
        <div className="grid min-w-[12rem] gap-1">
          <Label htmlFor="medicine-category-filter">{t('medicines.category')}</Label>
          <select
            id="medicine-category-filter"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value)
              setPage(1)
            }}
            className={selectClassName}
          >
            <option value="">{t('common.all')}</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
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
            {editing ? t('medicines.edit') : t('medicines.create')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="medicine-name">{t('common.name')}</Label>
              <Input
                id="medicine-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-generic">{t('medicines.genericName')}</Label>
              <Input
                id="medicine-generic"
                value={form.genericName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, genericName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-category">{t('medicines.category')}</Label>
              <select
                id="medicine-category"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
                className={selectClassName}
                required
              >
                <option value="">{t('common.emDash')}</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-lab">{t('medicines.laboratory')}</Label>
              <Input
                id="medicine-lab"
                value={form.laboratory}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, laboratory: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-barcode">{t('medicines.barcode')}</Label>
              <Input
                id="medicine-barcode"
                value={form.barcode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, barcode: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-supplier">{t('medicines.supplier')}</Label>
              <select
                id="medicine-supplier"
                value={form.supplier}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supplier: event.target.value }))
                }
                className={selectClassName}
              >
                <option value="">{t('common.emDash')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-purchase">{t('medicines.purchasePrice')}</Label>
              <Input
                id="medicine-purchase"
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
              <Label htmlFor="medicine-selling">{t('medicines.sellingPrice')}</Label>
              <Input
                id="medicine-selling"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sellingPrice: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-min-stock">{t('medicines.minimumStock')}</Label>
              <Input
                id="medicine-min-stock"
                type="number"
                min="0"
                step="1"
                value={form.minimumStock}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, minimumStock: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-unit">{t('medicines.unit')}</Label>
              <Input
                id="medicine-unit"
                value={form.unit}
                onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="medicine-description">{t('common.description')}</Label>
              <Input
                id="medicine-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
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
        <p className="text-sm text-muted-foreground">{t('medicines.empty')}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('common.name')}</th>
                <th className="px-3 py-2 font-medium">{t('medicines.genericName')}</th>
                <th className="px-3 py-2 font-medium">{t('medicines.category')}</th>
                <th className="px-3 py-2 font-medium">{t('medicines.sellingPrice')}</th>
                <th className="px-3 py-2 font-medium">{t('medicines.minimumStock')}</th>
                <th className="px-3 py-2 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((medicine) => (
                <tr key={medicine._id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      to={`/medicines/${medicine._id}`}
                      className="text-primary hover:underline"
                    >
                      {medicine.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {medicine.genericName || t('common.emDash')}
                  </td>
                  <td className="px-3 py-2">{namedRef(medicine.category)}</td>
                  <td className="px-3 py-2">{money(medicine.sellingPrice)}</td>
                  <td className="px-3 py-2">{medicine.minimumStock}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/medicines/${medicine._id}`}
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
                            onClick={() => openEdit(medicine)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingId === medicine._id}
                            onClick={() => void onDelete(medicine)}
                          >
                            {deletingId === medicine._id
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
