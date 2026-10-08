import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import type { TranslationKey } from '@/i18n'
import { cancelSale, getSale, type Sale } from '@/services/commerce-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

export function SaleDetailPage() {
  const { id = '' } = useParams()
  const { t } = useLocale()
  const { canCancelSale } = usePermissions()
  const { money, date, dateTime } = useFormatters()
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const data = await getSale(id)
        if (!cancelled) setSale(data)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('sales.loadFailed')))
          setSale(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  async function onCancel() {
    if (!sale || !window.confirm(t('sales.confirmCancel'))) return
    setCancelling(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await cancelSale(sale._id)
      setSale(updated)
      setMessage(t('sales.cancelled'))
    } catch (err) {
      setError(getErrorMessage(err, t('sales.cancelFailed')))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('sales.details')}
        description={sale ? sale.invoiceNumber : t('sales.subtitle')}
        actions={
          <Link to="/sales">
            <Button type="button" variant="outline" size="sm">
              {t('common.back')}
            </Button>
          </Link>
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

      {message ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      {!loading && sale ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info label={t('sales.invoice')} value={sale.invoiceNumber} />
            <Info
              label={t('sales.customerName')}
              value={sale.customerName?.trim() || t('common.emDash')}
            />
            <Info
              label={t('sales.customerPhone')}
              value={sale.customerPhone?.trim() || t('common.emDash')}
            />
            <Info
              label={t('sales.paymentMethod')}
              value={t(`sales.payment.${sale.paymentMethod}` as TranslationKey)}
            />
            <Info
              label={t('common.status')}
              value={t(`sales.status.${sale.status}` as TranslationKey)}
            />
            <Info label={t('common.details')} value={dateTime(sale.createdAt)} />
            <Info label={t('sales.subtotal')} value={money(sale.subtotal)} />
            <Info label={t('sales.discount')} value={money(sale.discount)} />
            <Info label={t('sales.tax')} value={money(sale.tax)} />
            <Info label={t('sales.total')} value={money(sale.total)} />
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">{t('sales.items')}</h2>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('common.medicine')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.batch')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.quantity')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.price')}</th>
                    <th className="px-3 py-2 font-medium">{t('sales.total')}</th>
                    <th className="px-3 py-2 font-medium">{t('sales.expiry')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, index) => (
                    <tr key={item._id ?? index} className="border-t border-border">
                      <td className="px-3 py-2">
                        {item.medicine?.name ?? t('common.emDash')}
                      </td>
                      <td className="px-3 py-2">
                        {item.batch?.batchNumber ?? t('common.emDash')}
                      </td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{money(item.unitPrice)}</td>
                      <td className="px-3 py-2">{money(item.totalPrice)}</td>
                      <td className="px-3 py-2">{date(item.batch?.expirationDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canCancelSale && sale.status === 'COMPLETED' ? (
            <div>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelling}
                onClick={() => void onCancel()}
              >
                {cancelling ? t('sales.cancelling') : t('sales.cancelAction')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
