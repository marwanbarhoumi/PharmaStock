import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import type { TranslationKey } from '@/i18n'
import { classifyReportHttpStatus } from '@/lib/report-access'
import {
  downloadReportCsv,
  fetchReport,
  type PaginationMeta,
  type ReportType,
} from '@/services/dashboard-api'
import { getErrorMessage } from '@/utils/error'

const REPORT_TYPE_KEYS: Record<ReportType, TranslationKey> = {
  sales: 'reports.type.sales',
  purchases: 'reports.type.purchases',
  stock: 'reports.type.stock',
  'low-stock': 'reports.type.lowStock',
  expiration: 'reports.type.expiration',
  profit: 'reports.type.profit',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - (days - 1))
  return date.toISOString().slice(0, 10)
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function asRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data as Array<Record<string, unknown>>
  }
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: Array<Record<string, unknown>> }).items
  }
  return []
}

export function ReportsPage() {
  const { t, locale } = useLocale()
  const { canViewReports } = usePermissions()
  const [type, setType] = useState<ReportType>('sales')
  const [from, setFrom] = useState(daysAgoIso(30))
  const [to, setTo] = useState(todayIso())
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<unknown>(null)
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!canViewReports) {
      setLoading(false)
      setError(null)
      setPayload(null)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchReport(type, {
          from,
          to,
          page,
          limit: 10,
        })
        if (cancelled) return
        setPayload(result.data)
        setPagination(result.pagination)
      } catch (err) {
        if (!cancelled) {
          const status = axios.isAxiosError(err)
            ? err.response?.status
            : undefined
          const kind = classifyReportHttpStatus(status)
          if (kind === 'forbidden') {
            setError(t('reports.forbidden'))
          } else if (kind === 'unauthorized') {
            setError(t('auth.unauthorized'))
          } else {
            setError(getErrorMessage(err, t('reports.loadFailed')))
          }
          setPayload(null)
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
  }, [type, from, to, page, t, canViewReports])

  const rows = useMemo(() => asRows(payload), [payload])

  const summary = useMemo(() => {
    if (!payload || typeof payload !== 'object') return null
    const data = (payload as { summary?: Record<string, number> }).summary
    if (!data) return null

    if (type === 'sales') {
      return t('reports.summary.sales', {
        count: data.count ?? 0,
        amount: formatMoney(data.revenue ?? 0, locale),
      })
    }
    if (type === 'purchases') {
      return t('reports.summary.purchases', {
        count: data.count ?? 0,
        amount: formatMoney(data.spend ?? 0, locale),
      })
    }
    if (type === 'profit') {
      return t('reports.summary.profit', {
        revenue: formatMoney(data.revenue ?? 0, locale),
        cost: formatMoney(data.cost ?? 0, locale),
        profit: formatMoney(data.profit ?? 0, locale),
      })
    }
    return null
  }, [payload, type, t, locale])

  async function onExport() {
    if (!canViewReports) {
      setError(t('reports.forbidden'))
      return
    }
    setExporting(true)
    setError(null)
    try {
      await downloadReportCsv(type, from, to)
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const kind = classifyReportHttpStatus(status)
      if (kind === 'forbidden') {
        setError(t('reports.forbidden'))
      } else if (kind === 'unauthorized') {
        setError(t('auth.unauthorized'))
      } else {
        setError(getErrorMessage(err, t('reports.exportFailed')))
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6 print:gap-3">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          canViewReports ? (
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                {t('reports.print')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={exporting}
                onClick={() => void onExport()}
              >
                {exporting ? t('reports.exporting') : t('reports.export')}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t('reports.report')}
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as ReportType)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {(Object.keys(REPORT_TYPE_KEYS) as ReportType[]).map((value) => (
              <option key={value} value={value}>
                {t(REPORT_TYPE_KEYS[value])}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t('common.from')}
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t('common.to')}
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>

      {summary ? (
        <p className="text-sm font-medium text-foreground">{summary}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('reports.loading')}</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('reports.empty')}</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {Object.keys(rows[0] ?? {})
                  .filter((key) => !key.startsWith('_') && key !== '__v')
                  .slice(0, 8)
                  .map((key) => (
                    <th key={key} className="px-3 py-2 font-medium">
                      {key}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const keys = Object.keys(row)
                  .filter((key) => !key.startsWith('_') && key !== '__v')
                  .slice(0, 8)
                return (
                  <tr key={String(row._id ?? index)} className="border-t border-border">
                    {keys.map((key) => {
                      const value = row[key]
                      let display: string
                      if (value === null || value === undefined) {
                        display = t('common.emDash')
                      } else if (
                        value &&
                        typeof value === 'object' &&
                        'name' in value &&
                        typeof (value as { name?: unknown }).name === 'string'
                      ) {
                        display = String((value as { name: string }).name)
                      } else if (typeof value === 'object') {
                        display = JSON.stringify(value)
                      } else {
                        display = String(value)
                      }

                      return (
                        <td key={key} className="px-3 py-2 align-top">
                          {display}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center gap-3 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('common.previous')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('reports.pageOf', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
