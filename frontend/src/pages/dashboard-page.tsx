import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Package,
  Pill,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { useLocale } from '@/contexts/locale-context'
import {
  fetchDashboardCharts,
  fetchDashboardRecent,
  fetchDashboardSummary,
  type ChartPoint,
  type DashboardRecent,
  type DashboardSummary,
} from '@/services/dashboard-api'
import { getErrorMessage } from '@/utils/error'

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

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon: typeof Pill
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" aria-hidden />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function DashboardPage() {
  const { t, locale } = useLocale()
  const [from, setFrom] = useState(daysAgoIso(30))
  const [to, setTo] = useState(todayIso())
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [series, setSeries] = useState<ChartPoint[]>([])
  const [recent, setRecent] = useState<DashboardRecent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [summaryData, chartsData, recentData] = await Promise.all([
          fetchDashboardSummary(from, to),
          fetchDashboardCharts(from, to),
          fetchDashboardRecent(),
        ])
        if (cancelled) return
        setSummary(summaryData)
        setSeries(chartsData.series)
        setRecent(recentData)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('dashboard.loadFailed')))
          setSummary(null)
          setSeries([])
          setRecent(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [from, to, t])

  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t('common.from')}
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t('common.to')}
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t('dashboard.stat.medicines')}
              value={summary.inventory.totalMedicines}
              icon={Pill}
            />
            <StatTile
              label={t('dashboard.stat.totalStock')}
              value={summary.inventory.totalStockQuantity}
              icon={Package}
            />
            <StatTile
              label={t('dashboard.stat.lowStock')}
              value={summary.inventory.lowStockMedicines}
              icon={AlertTriangle}
              hint={t('dashboard.stat.lowStockHint')}
            />
            <StatTile
              label={t('dashboard.stat.expiredBatches')}
              value={summary.inventory.expiredBatches}
              icon={Boxes}
              hint={t('dashboard.stat.expiringSoon', {
                count: summary.inventory.expiringSoonBatches,
                days: summary.inventory.expirationWarningDays,
              })}
            />
            <StatTile
              label={t('dashboard.stat.sales')}
              value={summary.commerce.totalSales}
              icon={ShoppingCart}
              hint={t('dashboard.stat.revenueHint', {
                amount: formatMoney(summary.commerce.revenue, locale),
              })}
            />
            <StatTile
              label={t('dashboard.stat.purchases')}
              value={summary.commerce.totalPurchases}
              icon={ClipboardList}
              hint={t('dashboard.stat.spendHint', {
                amount: formatMoney(summary.commerce.purchaseSpend, locale),
              })}
            />
            <StatTile
              label={t('dashboard.stat.revenue')}
              value={formatMoney(summary.commerce.revenue, locale)}
              icon={Wallet}
            />
            <StatTile
              label={t('dashboard.stat.profit')}
              value={formatMoney(summary.commerce.profit, locale)}
              icon={TrendingUp}
              hint={t('dashboard.stat.profitHint')}
            />
          </div>

          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="mb-4 text-lg font-medium">{t('dashboard.chart.title')}</h2>
            {series.every(
              (point) => point.salesTotal === 0 && point.purchasesTotal === 0,
            ) ? (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.chart.empty')}
              </p>
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="salesTotal"
                      name={t('dashboard.chart.sales')}
                      fill="#2f7f86"
                    />
                    <Bar
                      dataKey="purchasesTotal"
                      name={t('dashboard.chart.purchases')}
                      fill="#c2912e"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-3 text-lg font-medium">
                {t('dashboard.recentSales')}
              </h2>
              {!recent?.recentSales.length ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.recentSalesEmpty')}
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recent.recentSales.map((sale) => (
                    <li
                      key={sale._id}
                      className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0"
                    >
                      <div>
                        <p className="font-medium">{sale.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleString(
                            locale === 'ar' ? 'ar' : 'fr-FR',
                          )}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatMoney(sale.total, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-3 text-lg font-medium">
                {t('dashboard.recentMovements')}
              </h2>
              {!recent?.recentMovements.length ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.recentMovementsEmpty')}
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recent.recentMovements.map((movement) => (
                    <li
                      key={movement._id}
                      className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0"
                    >
                      <div>
                        <p className="font-medium">
                          {movement.type} ·{' '}
                          {movement.medicine?.name ?? t('common.medicine')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movement.batch?.batchNumber ?? t('common.emDash')} ·{' '}
                          {new Date(movement.createdAt).toLocaleString(
                            locale === 'ar' ? 'ar' : 'fr-FR',
                          )}
                        </p>
                      </div>
                      <p className="font-medium">{movement.quantity}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
