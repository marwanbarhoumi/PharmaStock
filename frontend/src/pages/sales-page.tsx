import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import type { TranslationKey } from '@/i18n'
import {
  listSales,
  type Sale,
  type SaleStatus,
} from '@/services/commerce-api'
import type { PaginationMeta } from '@/services/dashboard-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

const SALE_STATUSES: SaleStatus[] = ['COMPLETED', 'CANCELLED']

export function SalesPage() {
  const { t } = useLocale()
  const { money, dateTime } = useFormatters()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | SaleStatus>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Sale[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await listSales({
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
          setError(getErrorMessage(err, t('sales.loadFailed')))
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
        title={t('sales.title')}
        description={t('sales.subtitle')}
        actions={
          <Link to="/sales/new">
            <Button type="button" size="sm">
              {t('sales.create')}
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[12rem] flex-1 gap-1.5">
          <Label htmlFor="sales-search">{t('common.search')}</Label>
          <Input
            id="sales-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sales-status">{t('common.status')}</Label>
          <select
            id="sales-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | SaleStatus)
              setPage(1)
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">{t('common.all')}</option>
            {SALE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`sales.status.${value}` as TranslationKey)}
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
        <p className="text-sm text-muted-foreground">{t('sales.empty')}</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('sales.invoice')}</th>
                <th className="px-3 py-2 font-medium">{t('sales.customerName')}</th>
                <th className="px-3 py-2 font-medium">{t('sales.total')}</th>
                <th className="px-3 py-2 font-medium">{t('common.status')}</th>
                <th className="px-3 py-2 font-medium">{t('common.details')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sale) => (
                <tr key={sale._id} className="border-t border-border">
                  <td className="px-3 py-2">{sale.invoiceNumber}</td>
                  <td className="px-3 py-2">
                    {sale.customerName?.trim() || t('common.emDash')}
                  </td>
                  <td className="px-3 py-2">{money(sale.total)}</td>
                  <td className="px-3 py-2">
                    {t(`sales.status.${sale.status}` as TranslationKey)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {dateTime(sale.createdAt)}
                      </span>
                      <Link
                        to={`/sales/${sale._id}`}
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
