import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { listAuditLogs, type AuditLogRow } from '@/services/audit-api'
import type { PaginationMeta } from '@/services/dashboard-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

export function AuditLogsPage() {
  const { t } = useLocale()
  const { dateTime } = useFormatters()
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await listAuditLogs({
          page,
          limit: 20,
          action: action.trim() || undefined,
          entity: entity.trim() || undefined,
        })
        if (cancelled) return
        setRows(result.data)
        setPagination(result.pagination)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('audit.loadFailed')))
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
  }, [page, action, entity, t])

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader title={t('audit.title')} description={t('audit.subtitle')} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          <Label>{t('audit.action')}</Label>
          <Input
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            placeholder="CREATE_SALE"
            className="h-9 w-48"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          <Label>{t('audit.entity')}</Label>
          <Input
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value)
              setPage(1)
            }}
            placeholder="Sale"
            className="h-9 w-40"
          />
        </label>
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
        <p className="text-sm text-muted-foreground">{t('audit.empty')}</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('audit.when')}</th>
                <th className="px-3 py-2 font-medium">{t('audit.user')}</th>
                <th className="px-3 py-2 font-medium">{t('audit.action')}</th>
                <th className="px-3 py-2 font-medium">{t('audit.entity')}</th>
                <th className="px-3 py-2 font-medium">{t('common.description')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {dateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    {row.user
                      ? `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim() ||
                        row.user.email ||
                        t('common.emDash')
                      : t('common.emDash')}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.action}</td>
                  <td className="px-3 py-2">{row.entity}</td>
                  <td className="px-3 py-2">{row.description || t('common.emDash')}</td>
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
