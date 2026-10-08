import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '@/components/common/page-header'
import { PaginationBar } from '@/components/common/pagination-bar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { usePermissions } from '@/hooks/use-permissions'
import type { TranslationKey } from '@/i18n'
import type { PaginationMeta } from '@/services/dashboard-api'
import {
  fetchAlerts,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  runAlertCheck,
  type AlertsSnapshot,
  type AppNotification,
  type NotificationSeverity,
} from '@/services/notifications-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

const SEVERITY_KEYS: Record<NotificationSeverity, TranslationKey> = {
  INFO: 'notifications.severity.INFO',
  WARNING: 'notifications.severity.WARNING',
  CRITICAL: 'notifications.severity.CRITICAL',
}

function severityLabel(
  severity: string | undefined,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  if (severity === 'INFO' || severity === 'WARNING' || severity === 'CRITICAL') {
    return t(SEVERITY_KEYS[severity])
  }
  return severity || t('notifications.severity.INFO')
}

export function NotificationsPage() {
  const { t } = useLocale()
  const { canRunAlertCheck } = usePermissions()
  const { dateTime, date } = useFormatters()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AppNotification[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | undefined>()
  const [unreadCount, setUnreadCount] = useState(0)
  const [alerts, setAlerts] = useState<AlertsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refreshMeta = useCallback(async () => {
    const [countResult, alertsResult] = await Promise.allSettled([
      getUnreadNotificationCount(),
      fetchAlerts(),
    ])

    if (countResult.status === 'fulfilled') {
      setUnreadCount(countResult.value)
    }
    if (alertsResult.status === 'fulfilled') {
      setAlerts(alertsResult.value)
    } else if (alertsResult.status === 'rejected') {
      throw alertsResult.reason
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await listNotifications({
          page,
          limit: 10,
          isRead: unreadOnly ? 'false' : undefined,
        })
        if (cancelled) return
        setRows(result.data)
        setPagination(result.pagination)

        try {
          await refreshMeta()
        } catch (metaErr) {
          if (!cancelled) {
            setError(getErrorMessage(metaErr, t('notifications.loadFailed')))
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('notifications.loadFailed')))
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
  }, [page, unreadOnly, t, refreshMeta])

  async function onMarkRead(id: string) {
    setError(null)
    try {
      const updated = await markNotificationRead(id)
      setRows((current) =>
        current.map((row) => (row._id === id ? { ...row, ...updated, isRead: true } : row)),
      )
      await refreshMeta().catch(() => undefined)
    } catch (err) {
      setError(getErrorMessage(err, t('notifications.loadFailed')))
    }
  }

  async function onMarkAllRead() {
    setMarkingAll(true)
    setError(null)
    setMessage(null)
    try {
      await markAllNotificationsRead()
      setRows((current) => current.map((row) => ({ ...row, isRead: true })))
      await refreshMeta().catch(() => undefined)
    } catch (err) {
      setError(getErrorMessage(err, t('notifications.loadFailed')))
    } finally {
      setMarkingAll(false)
    }
  }

  async function onRunCheck() {
    setChecking(true)
    setError(null)
    setMessage(null)
    try {
      const result = await runAlertCheck()
      setMessage(
        t('notifications.checkDone', {
          created: result?.notificationsCreated ?? 0,
        }),
      )
      const list = await listNotifications({
        page,
        limit: 10,
        isRead: unreadOnly ? 'false' : undefined,
      })
      setRows(list.data)
      setPagination(list.pagination)
      await refreshMeta().catch(() => undefined)
    } catch (err) {
      setError(getErrorMessage(err, t('notifications.checkFailed')))
    } finally {
      setChecking(false)
    }
  }

  const lowStockItems = alerts?.lowStock.items ?? []
  const expirationItems = alerts?.expiration.items ?? []

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={markingAll || unreadCount === 0}
              onClick={() => void onMarkAllRead()}
            >
              {t('notifications.markAllRead')}
            </Button>
            {canRunAlertCheck ? (
              <Button
                type="button"
                size="sm"
                disabled={checking}
                onClick={() => void onRunCheck()}
              >
                {checking ? t('common.loading') : t('notifications.runCheck')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm font-medium text-foreground">
          {t('notifications.unreadCount', { count: unreadCount })}
        </p>
        <div className="flex items-center gap-2">
          <input
            id="unread-only"
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => {
              setUnreadOnly(event.target.checked)
              setPage(1)
            }}
            className="size-4 rounded border border-input"
          />
          <Label htmlFor="unread-only">{t('notifications.unreadOnly')}</Label>
        </div>
      </div>

      {message ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {rows.map((notification) => (
            <li
              key={notification._id}
              className="rounded-md border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p
                    className={`text-sm ${notification.isRead ? 'font-medium text-foreground' : 'font-semibold text-foreground'}`}
                  >
                    {notification.title || t('notifications.title')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {notification.message || t('common.emDash')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {severityLabel(notification.severity, t)} ·{' '}
                    {dateTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onMarkRead(notification._id)}
                  >
                    {t('notifications.markRead')}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <PaginationBar pagination={pagination} page={page} onPageChange={setPage} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('notifications.alerts')}</h2>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            {t('notifications.lowStock')}
          </h3>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('common.medicine')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.totalQuantity')}</th>
                    <th className="px-3 py-2 font-medium">{t('stock.isLowStock')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr
                      key={item.medicineId || item.medicineName}
                      className="border-t border-border"
                    >
                      <td className="px-3 py-2">{item.medicineName || t('common.emDash')}</td>
                      <td className="px-3 py-2">
                        {item.totalQuantity ?? 0}
                        {item.unit ? ` ${item.unit}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {item.minimumStock ?? 0} / −{item.deficit ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            {t('notifications.expiration')}
          </h3>
          {expirationItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('common.medicine')}</th>
                    <th className="px-3 py-2 font-medium">{t('purchases.batchNumber')}</th>
                    <th className="px-3 py-2 font-medium">{t('common.quantity')}</th>
                    <th className="px-3 py-2 font-medium">
                      {t('purchases.expirationDate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expirationItems.map((item) => (
                    <tr
                      key={item.batchId || `${item.medicineId}-${item.batchNumber}`}
                      className="border-t border-border"
                    >
                      <td className="px-3 py-2">{item.medicineName || t('common.emDash')}</td>
                      <td className="px-3 py-2">{item.batchNumber || t('common.emDash')}</td>
                      <td className="px-3 py-2">{item.quantity ?? 0}</td>
                      <td className="px-3 py-2">
                        {date(item.expirationDate)} ({item.daysUntilExpiration ?? 0})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
