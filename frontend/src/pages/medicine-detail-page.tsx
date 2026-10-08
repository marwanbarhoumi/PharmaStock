import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import { deleteMedicine, getMedicine, type Medicine } from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'
import { namedRef, useFormatters } from '@/utils/format'

export function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLocale()
  const { canWriteInventory } = usePermissions()
  const { money, date } = useFormatters()

  const [medicine, setMedicine] = useState<Medicine | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setError(t('medicines.loadFailed'))
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await getMedicine(id)
      setMedicine(data)
    } catch (err) {
      setError(getErrorMessage(err, t('medicines.loadFailed')))
      setMedicine(null)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  async function onDelete() {
    if (!medicine || !window.confirm(t('common.confirmDelete'))) return

    setDeleting(true)
    setError(null)
    try {
      await deleteMedicine(medicine._id)
      navigate('/medicines')
    } catch (err) {
      setError(getErrorMessage(err, t('medicines.deleteFailed')))
      setDeleting(false)
    }
  }

  const batches = medicine?.batches ?? []
  const totalStock =
    medicine?.totalQuantity ??
    batches.reduce((sum, batch) => sum + (batch.quantity ?? 0), 0)

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={medicine?.name ?? t('medicines.details')}
        description={t('medicines.details')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/medicines"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('common.back')}
            </Link>
            {canWriteInventory && medicine ? (
              <>
                <Link
                  to="/medicines"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  {t('common.edit')}
                </Link>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => void onDelete()}
                >
                  {deleting ? t('common.deleting') : t('common.delete')}
                </Button>
              </>
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

      {!loading && medicine ? (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-start text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-48 bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('common.name')}
                  </th>
                  <td className="px-3 py-2">{medicine.name}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.genericName')}
                  </th>
                  <td className="px-3 py-2">
                    {medicine.genericName || t('common.emDash')}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('common.description')}
                  </th>
                  <td className="px-3 py-2">
                    {medicine.description || t('common.emDash')}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.category')}
                  </th>
                  <td className="px-3 py-2">{namedRef(medicine.category)}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.supplier')}
                  </th>
                  <td className="px-3 py-2">{namedRef(medicine.supplier)}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.laboratory')}
                  </th>
                  <td className="px-3 py-2">
                    {medicine.laboratory || t('common.emDash')}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.barcode')}
                  </th>
                  <td className="px-3 py-2">{medicine.barcode || t('common.emDash')}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.purchasePrice')}
                  </th>
                  <td className="px-3 py-2">{money(medicine.purchasePrice)}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.sellingPrice')}
                  </th>
                  <td className="px-3 py-2">{money(medicine.sellingPrice)}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.minimumStock')}
                  </th>
                  <td className="px-3 py-2">{medicine.minimumStock}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.unit')}
                  </th>
                  <td className="px-3 py-2">{medicine.unit || t('common.emDash')}</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('medicines.totalStock')}
                  </th>
                  <td className="px-3 py-2">{totalStock}</td>
                </tr>
                <tr>
                  <th className="bg-muted/50 px-3 py-2 text-start font-medium text-muted-foreground">
                    {t('common.status')}
                  </th>
                  <td className="px-3 py-2">
                    {medicine.isActive ? t('common.active') : t('common.inactive')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium">{t('medicines.batches')}</h2>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('batches.empty')}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-start text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('batches.batchNumber')}</th>
                      <th className="px-3 py-2 font-medium">{t('common.quantity')}</th>
                      <th className="px-3 py-2 font-medium">{t('batches.purchasePrice')}</th>
                      <th className="px-3 py-2 font-medium">{t('batches.expirationDate')}</th>
                      <th className="px-3 py-2 font-medium">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch._id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{batch.batchNumber}</td>
                        <td className="px-3 py-2">{batch.quantity}</td>
                        <td className="px-3 py-2">{money(batch.purchasePrice)}</td>
                        <td className="px-3 py-2">{date(batch.expirationDate)}</td>
                        <td className="px-3 py-2">
                          <Link
                            to={`/batches/${batch._id}`}
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
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
