import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
  type PaginationMeta,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'

type CategoryForm = {
  name: string
  description: string
}

const emptyForm: CategoryForm = { name: '', description: '' }

export function CategoriesPage() {
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()

  const [items, setItems] = useState<Category[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<CategoryForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listCategories({ page, limit: 10, search: search.trim() || undefined })
      setItems(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(getErrorMessage(err, t('categories.loadFailed')))
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

  function openEdit(category: Category) {
    setEditing(category)
    setForm({
      name: category.name,
      description: category.description ?? '',
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
        description: form.description.trim() || undefined,
      }
      if (editing) {
        await updateCategory(editing._id, body)
      } else {
        await createCategory(body)
      }
      setSuccess(t('categories.saved'))
      closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('categories.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(category: Category) {
    if (!window.confirm(t('common.confirmDelete'))) return

    setDeletingId(category._id)
    setError(null)
    setSuccess(null)
    try {
      await deleteCategory(category._id)
      setSuccess(t('categories.deleted'))
      if (editing?._id === category._id) closeForm()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, t('categories.deleteFailed')))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('categories.title')}
        description={t('categories.subtitle')}
        actions={
          canWriteInventory ? (
            <Button type="button" size="sm" onClick={openCreate}>
              {t('categories.create')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[16rem] flex-1 gap-1">
          <Label htmlFor="category-search">{t('common.search')}</Label>
          <Input
            id="category-search"
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
            {editing ? t('categories.edit') : t('categories.create')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-name">{t('common.name')}</Label>
              <Input
                id="category-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category-description">{t('common.description')}</Label>
              <Input
                id="category-description"
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
        <p className="text-sm text-muted-foreground">{t('categories.empty')}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('common.name')}</th>
                <th className="px-3 py-2 font-medium">{t('common.description')}</th>
                <th className="px-3 py-2 font-medium">{t('common.status')}</th>
                {canWriteInventory ? (
                  <th className="px-3 py-2 font-medium">{t('common.actions')}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((category) => (
                <tr key={category._id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{category.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {category.description || t('common.emDash')}
                  </td>
                  <td className="px-3 py-2">
                    {category.isActive ? t('common.active') : t('common.inactive')}
                  </td>
                  {canWriteInventory ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(category)}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === category._id}
                          onClick={() => void onDelete(category)}
                        >
                          {deletingId === category._id
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
