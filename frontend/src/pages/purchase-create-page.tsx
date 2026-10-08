import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { RoleGate } from '@/components/common/role-gate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/contexts/locale-context'
import { createPurchase } from '@/services/commerce-api'
import {
  API_LIST_LIMIT_MAX,
  listMedicines,
  listSuppliers,
  type Medicine,
  type Supplier,
} from '@/services/inventory-api'
import { getErrorMessage } from '@/utils/error'

interface PurchaseLine {
  medicineId: string
  quantity: number
  unitPrice: number
  batchNumber: string
  expirationDate: string
}

function emptyLine(): PurchaseLine {
  return {
    medicineId: '',
    quantity: 1,
    unitPrice: 0,
    batchNumber: '',
    expirationDate: '',
  }
}

export function PurchaseCreatePage() {
  return (
    <RoleGate allow={['ADMIN', 'PHARMACIST']}>
      <PurchaseCreatePageContent />
    </RoleGate>
  )
}

function PurchaseCreatePageContent() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const [receiveNow, setReceiveNow] = useState(false)
  const [items, setItems] = useState<PurchaseLine[]>([emptyLine()])
  const [pending, setPending] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      setLoadingOptions(true)
      try {
        const [suppliersResult, medicinesResult] = await Promise.all([
          listSuppliers({ limit: API_LIST_LIMIT_MAX, isActive: 'true' }),
          listMedicines({ limit: API_LIST_LIMIT_MAX, isActive: 'true' }),
        ])
        if (cancelled) return
        setSuppliers(suppliersResult.data)
        setMedicines(medicinesResult.data)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('purchases.loadFailed')))
        }
      } finally {
        if (!cancelled) setLoadingOptions(false)
      }
    }

    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [t])

  function updateLine(index: number, patch: Partial<PurchaseLine>) {
    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    )
  }

  function onMedicineChange(index: number, medicineId: string) {
    const medicine = medicines.find((item) => item._id === medicineId)
    updateLine(index, {
      medicineId,
      unitPrice: medicine?.purchasePrice ?? 0,
    })
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

    if (!supplierId) {
      setError(t('common.required'))
      return
    }

    const payloadItems = items
      .filter(
        (line) =>
          line.medicineId &&
          line.quantity > 0 &&
          line.batchNumber.trim() &&
          line.expirationDate,
      )
      .map((line) => ({
        medicineId: line.medicineId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        batchNumber: line.batchNumber.trim(),
        expirationDate: line.expirationDate,
      }))

    if (payloadItems.length === 0) {
      setError(t('common.required'))
      return
    }

    setPending(true)
    try {
      const purchase = await createPurchase({
        supplierId,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        receiveNow,
        items: payloadItems,
      })
      navigate(`/purchases/${purchase._id}`)
    } catch (err) {
      setError(getErrorMessage(err, t('purchases.saveFailed')))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t('purchases.create')}
        description={t('purchases.subtitle')}
        actions={
          <Link to="/purchases">
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
            <Label htmlFor="supplierId">{t('purchases.supplier')}</Label>
            <select
              id="supplierId"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              required
              disabled={loadingOptions}
            >
              <option value="">{t('common.emDash')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {supplier.name}
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
              onChange={(event) => setDiscount(event.target.value)}
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
              onChange={(event) => setTax(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="receiveNow"
              type="checkbox"
              checked={receiveNow}
              onChange={(event) => setReceiveNow(event.target.checked)}
              className="size-4 rounded border border-input"
            />
            <Label htmlFor="receiveNow">{t('purchases.receiveNow')}</Label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('sales.items')}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              {t('common.addLine')}
            </Button>
          </div>

          {loadingOptions ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : null}

          {items.map((line, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor={`purchase-medicine-${index}`}>
                  {t('common.medicine')}
                </Label>
                <select
                  id={`purchase-medicine-${index}`}
                  value={line.medicineId}
                  onChange={(event) => onMedicineChange(index, event.target.value)}
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
                <Label htmlFor={`purchase-qty-${index}`}>{t('common.quantity')}</Label>
                <Input
                  id={`purchase-qty-${index}`}
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
              <div className="grid gap-1.5">
                <Label htmlFor={`purchase-unit-${index}`}>
                  {t('purchases.unitPrice')}
                </Label>
                <Input
                  id={`purchase-unit-${index}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(event) =>
                    updateLine(index, { unitPrice: Number(event.target.value) || 0 })
                  }
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`purchase-batch-${index}`}>
                  {t('purchases.batchNumber')}
                </Label>
                <Input
                  id={`purchase-batch-${index}`}
                  value={line.batchNumber}
                  onChange={(event) =>
                    updateLine(index, { batchNumber: event.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`purchase-exp-${index}`}>
                  {t('purchases.expirationDate')}
                </Label>
                <Input
                  id={`purchase-exp-${index}`}
                  type="date"
                  value={line.expirationDate}
                  onChange={(event) =>
                    updateLine(index, { expirationDate: event.target.value })
                  }
                  required
                />
              </div>
              <div className="flex items-end">
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
          <Button type="submit" disabled={pending || loadingOptions}>
            {pending ? t('common.saving') : t('common.save')}
          </Button>
          <Link to="/purchases">
            <Button type="button" variant="outline" disabled={pending}>
              {t('common.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </section>
  )
}
