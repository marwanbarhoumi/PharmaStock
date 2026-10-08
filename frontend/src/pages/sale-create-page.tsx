import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import type { TranslationKey } from '@/i18n'
import { createSale, type PaymentMethod } from '@/services/commerce-api'
import {
  API_LIST_LIMIT_MAX,
  getMedicineStock,
  listMedicines,
  type Medicine,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'
import { useFormatters } from '@/utils/format'

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'OTHER']

interface SaleLine {
  medicineId: string
  quantity: number
  availableStock?: number
  nearestExpiry?: string
}

function emptyLine(): SaleLine {
  return { medicineId: '', quantity: 1 }
}

function nearestExpiryFromBatches(
  batches: Array<{ expirationDate?: string; quantity?: number; isActive?: boolean }>,
) {
  const dates = batches
    .filter((batch) => batch.isActive !== false && (batch.quantity ?? 0) > 0 && batch.expirationDate)
    .map((batch) => batch.expirationDate as string)
    .sort()
  return dates[0]
}

export function SaleCreatePage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { date } = useFormatters()
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const [items, setItems] = useState<SaleLine[]>([emptyLine()])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMedicines, setLoadingMedicines] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadMedicines() {
      setLoadingMedicines(true)
      setError(null)
      try {
        const result = await listMedicines({
          limit: API_LIST_LIMIT_MAX,
          isActive: 'true',
        })
        if (!cancelled) setMedicines(result.data)
      } catch (err) {
        if (!cancelled) {
          setMedicines([])
          setError(getErrorMessage(err, t('medicines.loadFailed')))
        }
      } finally {
        if (!cancelled) setLoadingMedicines(false)
      }
    }

    void loadMedicines()
    return () => {
      cancelled = true
    }
  }, [t])

  function updateLine(index: number, patch: Partial<SaleLine>) {
    setError(null)
    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    )
  }

  async function loadStockForLine(index: number, medicineId: string) {
    setError(null)
    if (!medicineId) {
      setItems((current) =>
        current.map((line, i) =>
          i === index
            ? { ...line, medicineId: '', availableStock: undefined, nearestExpiry: undefined }
            : line,
        ),
      )
      return
    }

    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, medicineId } : line)),
    )

    try {
      const stock = await getMedicineStock(medicineId)
      setItems((current) =>
        current.map((line, i) =>
          i === index
            ? {
                ...line,
                medicineId,
                availableStock: stock.totalQuantity,
                nearestExpiry: nearestExpiryFromBatches(stock.batches),
              }
            : line,
        ),
      )
    } catch {
      setItems((current) =>
        current.map((line, i) =>
          i === index
            ? {
                ...line,
                medicineId,
                availableStock: undefined,
                nearestExpiry: undefined,
              }
            : line,
        ),
      )
    }
  }

  function addLine() {
    setItems((current) => [...current, emptyLine()])
  }

  function removeLine(index: number) {
    setItems((current) =>
      current.length <= 1 ? current : current.filter((_, i) => i !== index),
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const payloadItems = items
      .filter((line) => line.medicineId && line.quantity > 0)
      .map((line) => ({
        medicineId: line.medicineId,
        quantity: Number(line.quantity),
      }))

    if (payloadItems.length === 0) {
      setError(t('common.required'))
      return
    }

    setPending(true)
    try {
      const sale = await createSale({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        items: payloadItems,
      })
      navigate(`/sales/${sale._id}`)
    } catch (err) {
      setError(getErrorMessage(err, t('sales.saveFailed')))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('sales.create')}
        description={t('sales.subtitle')}
        actions={
          <Link to="/sales">
            <Button type="button" variant="outline" size="sm">
              {t('common.back')}
            </Button>
          </Link>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="customerName">{t('sales.customerName')}</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(event) => {
                setError(null)
                setCustomerName(event.target.value)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customerPhone">{t('sales.customerPhone')}</Label>
            <Input
              id="customerPhone"
              value={customerPhone}
              onChange={(event) => {
                setError(null)
                setCustomerPhone(event.target.value)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="paymentMethod">{t('sales.paymentMethod')}</Label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(event) => {
                setError(null)
                setPaymentMethod(event.target.value as PaymentMethod)
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`sales.payment.${method}` as TranslationKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="discount">{t('sales.discount')}</Label>
            <Input
              id="discount"
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(event) => {
                setError(null)
                setDiscount(event.target.value)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tax">{t('sales.tax')}</Label>
            <Input
              id="tax"
              type="number"
              min={0}
              step="0.01"
              value={tax}
              onChange={(event) => {
                setError(null)
                setTax(event.target.value)
              }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('sales.items')}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              {t('common.addLine')}
            </Button>
          </div>

          {loadingMedicines ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : null}

          {!loadingMedicines && medicines.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">{t('sales.noMedicines')}</p>
          ) : null}

          {items.map((line, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor={`medicine-${index}`}>{t('common.medicine')}</Label>
                <select
                  id={`medicine-${index}`}
                  value={line.medicineId}
                  onChange={(event) => void loadStockForLine(index, event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  required
                >
                  <option value="">{t('common.emDash')}</option>
                  {medicines.map((medicine) => (
                    <option key={medicine._id} value={medicine._id}>
                      {medicine.name}
                      {medicine.barcode ? ` (${medicine.barcode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`qty-${index}`}>{t('common.quantity')}</Label>
                <Input
                  id={`qty-${index}`}
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: Number(event.target.value) || 1 })
                  }
                  required
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <p className="text-xs text-muted-foreground">
                  {t('sales.availableStock')}:{' '}
                  {line.availableStock === undefined
                    ? t('common.emDash')
                    : line.availableStock}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('sales.expiry')}: {date(line.nearestExpiry)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(index)}
                  disabled={items.length <= 1}
                >
                  {t('common.removeLine')}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={pending || loadingMedicines || medicines.length === 0}
          >
            {pending ? t('common.saving') : t('common.save')}
          </Button>
          <Link to="/sales">
            <Button type="button" variant="outline" disabled={pending}>
              {t('common.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </section>
  )
}
