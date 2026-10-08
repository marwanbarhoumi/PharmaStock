import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import { deleteBatch, getBatch, type Batch } from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'
import { namedRef, useFormatters } from '@/utils/format'

function refId(value: string | { _id?: string } | null | undefined) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value._id ?? ''
}

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()
  const { money, date } = useFormatters()

  const [batch, setBatch] = useState<Batch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setError(t('batches.loadFailed'))
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await getBatch(id)
      setBatch(data)
    } catch (err) {
      setError(getErrorMessage(err, t('batches.loadFailed')))
      setBatch(null)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  async function onDelete() {
    if (!batch || !window.confirm(t('common.confirmDelete'))) return

    setDeleting(true)
    setError(null)
    try {
      await deleteBatch(batch._id)
      navigate('/batches')
    } catch (err) {
      setError(getErrorMessage(err, t('batches.deleteFailed')))
      setDeleting(false)
    }
  }

  const medicineId = batch ? refId(batch.medicine) : ''

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={batch?.batchNumber ?? t('batches.details')}
        description={t('batches.details')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/batches"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('common.back')}
            </Link>
            {medicineId ? (
              <Link
                to={`/medicines/${medicineId}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                {t('common.medicine')}
              </Link>
            ) : null}
            {canWriteInventory && batch ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => void onDelete()}
              >
                {deleting ? t('common.deleting') : t('common.delete')}
              </Button>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && batch ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th className="w-48 bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('batches.batchNumber')}
                </th>
                <td className="px-3 py-2">{batch.batchNumber}</td>
              </tr>
              <tr className="border-b border-border">
                <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('common.medicine')}
                </th>
                <td className="px-3 py-2">
                  {medicineId ? (
                    <Link
                      to={`/medicines/${medicineId}`}
                      className="text-primary hover:underline"
                    >
                      {namedRef(batch.medicine)}
                    </Link>
                  ) : (
                    namedRef(batch.medicine)
                  )}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('common.quantity')}
                </th>
                <td className="px-3 py-2">{batch.quantity}</td>
              </tr>
              <tr className="border-b border-border">
                <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('batches.purchasePrice')}
                </th>
                <td className="px-3 py-2">{money(batch.purchasePrice)}</td>
              </tr>
              <tr className="border-b border-border">
                <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('batches.expirationDate')}
                </th>
                <td className="px-3 py-2">{date(batch.expirationDate)}</td>
              </tr>
              <tr className="border-b border-border">
                <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('batches.receivedDate')}
                </th>
                <td className="px-3 py-2">{date(batch.receivedDate)}</td>
              </tr>
              <tr>
                <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                  {t('common.status')}
                </th>
                <td className="px-3 py-2">
                  {batch.isActive ? t('common.active') : t('common.inactive')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
