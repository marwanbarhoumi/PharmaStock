import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
  type PaginationMeta,
  type Supplier,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'

type SupplierForm = {
  name: string
  phone: string
  email: string
  address: string
  contactPerson: string
}

const emptyForm: SupplierForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  contactPerson: '',
}

export function SuppliersPage() {
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()

  const [items, setItems] = useState<Supplier[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listSuppliers({ page, limit: 10, search: search.trim() || undefined })
      setItems(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(getErrorMessage(err, t('suppliers.loadFailed')))
      setItems([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, search, t])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
    setSuccess(null)
    setError(null)
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      contactPerson: supplier.contactPerson ?? '',
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
    if (!form.name.trim()) {
      setError(t('common.required'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
      }
      if (editing) {
        await updateSupplier(editing._id, body)
      } else {
        await createSupplier(body)
      }
      setSuccess(t('suppliers.saved'))
      closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('suppliers.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(supplier: Supplier) {
    if (!window.confirm(t('common.confirmDelete'))) return

    setDeletingId(supplier._id)
    setError(null)
    setSuccess(null)
    try {
      await deleteSupplier(supplier._id)
      setSuccess(t('suppliers.deleted'))
      if (editing?._id === supplier._id) closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('suppliers.deleteFailed')))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('suppliers.title')}
        description={t('suppliers.subtitle')}
        actions={
          canWriteInventory ? (
            <Button type="button" size="sm" onClick={openCreate}>
              {t('suppliers.create')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[16rem] flex-1 gap-1">
          <Label htmlFor="supplier-search">{t('common.search')}</Label>
          <Input
            id="supplier-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
          />
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
            {editing ? t('suppliers.edit') : t('suppliers.create')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">{t('common.name')}</Label>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">{t('suppliers.phone')}</Label>
              <Input
                id="supplier-phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-email">{t('suppliers.email')}</Label>
              <Input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-contact">{t('suppliers.contactPerson')}</Label>
              <Input
                id="supplier-contact"
                value={form.contactPerson}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactPerson: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-address">{t('suppliers.address')}</Label>
              <Input
                id="supplier-address"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
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
        <p className="text-sm text-muted-foreground">{t('suppliers.empty')}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('common.name')}</th>
                <th className="px-3 py-2 font-medium">{t('suppliers.phone')}</th>
                <th className="px-3 py-2 font-medium">{t('suppliers.email')}</th>
                <th className="px-3 py-2 font-medium">{t('suppliers.contactPerson')}</th>
                <th className="px-3 py-2 font-medium">{t('suppliers.address')}</th>
                {canWriteInventory ? (
                  <th className="px-3 py-2 font-medium">{t('common.actions')}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((supplier) => (
                <tr key={supplier._id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{supplier.name}</td>
                  <td className="px-3 py-2">{supplier.phone || t('common.emDash')}</td>
                  <td className="px-3 py-2">{supplier.email || t('common.emDash')}</td>
                  <td className="px-3 py-2">
                    {supplier.contactPerson || t('common.emDash')}
                  </td>
                  <td className="px-3 py-2">{supplier.address || t('common.emDash')}</td>
                  {canWriteInventory ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(supplier)}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === supplier._id}
                          onClick={() => void onDelete(supplier)}
                        >
                          {deletingId === supplier._id
                            ? t('common.deleting')
                            : t('common.delete')}
                        </Button>
                      </div>
                    </td>
                  ) : null}
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
