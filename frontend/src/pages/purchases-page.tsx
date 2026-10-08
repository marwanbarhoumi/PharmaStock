import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { RoleGate } from '@/components/common/role-gate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import type { TranslationKey } from '@/i18n'
import {
  listPurchases,
  type Purchase,
  type PurchaseStatus,
} from '@/services/commerce-api'
import type { PaginationMeta } from '@/services/dashboard-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

const PURCHASE_STATUSES: PurchaseStatus[] = ['PENDING', 'RECEIVED', 'CANCELLED']

export function PurchasesPage() {
  return (
    <RoleGate allow={['ADMIN', 'PHARMACIST']}>
      <PurchasesPageContent />
    </RoleGate>
  )
}

function PurchasesPageContent() {
  const { t } = useLocale()
  const { money, date } = useFormatters()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | PurchaseStatus>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Purchase[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await listPurchases({
          search: search.trim() || undefined,
          status: status || undefined,
          page,
          limit: 10,
        })
        if (cancelled) return
        setRows(result.data)
        setPagination(result.pagination)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('purchases.loadFailed')))
          setRows([])
          setPagination(undefined)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [search, status, page, t])

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('purchases.title')}
        description={t('purchases.subtitle')}
        actions={
          <Link to="/purchases/new">
            <Button type="button" size="sm">
              {t('purchases.create')}
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[12rem] flex-1 gap-1.5">
          <Label htmlFor="purchases-search">{t('common.search')}</Label>
          <Input
            id="purchases-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="purchases-status">{t('common.status')}</Label>
          <select
            id="purchases-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | PurchaseStatus)
              setPage(1)
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">{t('common.all')}</option>
            {PURCHASE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`purchases.status.${value}` as TranslationKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('purchases.empty')}</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('purchases.number')}</th>
                <th className="px-3 py-2 font-medium">{t('purchases.supplier')}</th>
                <th className="px-3 py-2 font-medium">{t('sales.total')}</th>
                <th className="px-3 py-2 font-medium">{t('common.status')}</th>
                <th className="px-3 py-2 font-medium">{t('common.details')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((purchase) => (
                <tr key={purchase._id} className="border-t border-border">
                  <td className="px-3 py-2">{purchase.purchaseNumber}</td>
                  <td className="px-3 py-2">
                    {purchase.supplier?.name ?? t('common.emDash')}
                  </td>
                  <td className="px-3 py-2">{money(purchase.total)}</td>
                  <td className="px-3 py-2">
                    {t(`purchases.status.${purchase.status}` as TranslationKey)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {date(purchase.purchaseDate)}
                      </span>
                      <Link
                        to={`/purchases/${purchase._id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t('common.details')}
                      </Link>
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
