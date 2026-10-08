import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { RoleGate } from '@/components/common/role-gate'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import type { TranslationKey } from '@/i18n'
import {
  cancelPurchase,
  getPurchase,
  receivePurchase,
  type Purchase,
} from '@/services/commerce-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

export function PurchaseDetailPage() {
  return (
    <RoleGate allow={['ADMIN', 'PHARMACIST']}>
      <PurchaseDetailPageContent />
    </RoleGate>
  )
}

function PurchaseDetailPageContent() {
  const { id = '' } = useParams()
  const { t } = useLocale()
  const { money, date } = useFormatters()
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<'receive' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const data = await getPurchase(id)
        if (!cancelled) setPurchase(data)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('purchases.loadFailed')))
          setPurchase(null)
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

  async function onReceive() {
    if (!purchase || !window.confirm(t('purchases.confirmReceive'))) return
    setProcessing('receive')
    setError(null)
    setMessage(null)
    try {
      const updated = await receivePurchase(purchase._id)
      setPurchase(updated)
      setMessage(t('purchases.received'))
    } catch (err) {
      setError(getErrorMessage(err, t('purchases.receiveFailed')))
    } finally {
      setProcessing(null)
    }
  }

  async function onCancel() {
    if (!purchase || !window.confirm(t('purchases.confirmCancel'))) return
    setProcessing('cancel')
    setError(null)
    setMessage(null)
    try {
      const updated = await cancelPurchase(purchase._id)
      setPurchase(updated)
      setMessage(t('purchases.cancelled'))
    } catch (err) {
      setError(getErrorMessage(err, t('purchases.cancelFailed')))
    } finally {
      setProcessing(null)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('purchases.details')}
        description={purchase ? purchase.purchaseNumber : t('purchases.subtitle')}
        actions={
          <Link to="/purchases">
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

      {!loading && purchase ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info label={t('purchases.number')} value={purchase.purchaseNumber} />
            <Info
              label={t('purchases.supplier')}
              value={purchase.supplier?.name ?? t('common.emDash')}
            />
            <Info
              label={t('common.status')}
              value={t(`purchases.status.${purchase.status}` as TranslationKey)}
            />
            <Info label={t('common.details')} value={date(purchase.purchaseDate)} />
            <Info label={t('sales.subtotal')} value={money(purchase.subtotal)} />
            <Info label={t('sales.discount')} value={money(purchase.discount)} />
            <Info label={t('sales.tax')} value={money(purchase.tax)} />
            <Info label={t('sales.total')} value={money(purchase.total)} />
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">{t('sales.items')}</h2>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('common.medicine')}</th>
                    <th className="px-3 py-2 font-medium">{t('purchases.batchNumber')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.quantity')}</th>
                    <th className="px-3 py-2 font-medium">{t('purchases.unitPrice')}</th>
                    <th className="px-3 py-2 font-medium">{t('sales.total')}</th>
                    <th className="px-3 py-2 font-medium">
                      {t('purchases.expirationDate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item, index) => (
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

          {purchase.status === 'PENDING' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={processing !== null}
                onClick={() => void onReceive()}
              >
                {processing === 'receive'
                  ? t('purchases.receiving')
                  : t('purchases.receive')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={processing !== null}
                onClick={() => void onCancel()}
              >
                {t('purchases.cancelAction')}
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
