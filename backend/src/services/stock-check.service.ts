import { loadEnv } from '../config/env.js'
import { Notification, User } from '../models/index.js'
import type { NotificationSeverity, NotificationType } from '../types/enums.js'
import { findExpirationAlerts } from './expiration-alert.service.js'
import { findLowStockAlerts } from './low-stock-alert.service.js'

export interface StockCheckSummary {
  checkedAt: string
  warningDays: number
  expirationAlerts: number
  lowStockAlerts: number
  notificationsCreated: number
  lowStockResolved: number
  recipientCount: number
}

async function getAlertRecipients(): Promise<string[]> {
  const users = await User.find({
    isActive: true,
    role: { $in: ['ADMIN', 'PHARMACIST'] },
  })
    .select('_id')
    .lean()

  return users.map((user) => String(user._id))
}

async function hasUnreadNotification(input: {
  userId: string
  type: NotificationType
  medicineId: string
  batchId?: string | null
}): Promise<boolean> {
  const filter: Record<string, unknown> = {
    user: input.userId,
    type: input.type,
    relatedMedicine: input.medicineId,
    isRead: false,
  }

  if (input.batchId) {
    filter.relatedBatch = input.batchId
  } else {
    filter.relatedBatch = null
  }

  const existing = await Notification.exists(filter)
  return Boolean(existing)
}

async function createNotificationIfNeeded(input: {
  userId: string
  type: NotificationType
  title: string
  message: string
  severity: NotificationSeverity
  medicineId: string
  batchId?: string | null
}): Promise<boolean> {
  const exists = await hasUnreadNotification({
    userId: input.userId,
    type: input.type,
    medicineId: input.medicineId,
    batchId: input.batchId ?? null,
  })

  if (exists) {
    return false
  }

  await Notification.create({
    user: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    severity: input.severity,
    relatedMedicine: input.medicineId,
    relatedBatch: input.batchId ?? null,
    isRead: false,
  })

  return true
}

/**
 * Runs expiration + low-stock detection, creates deduplicated notifications,
 * and resolves low-stock alerts when stock recovers.
 */
export async function runStockChecks(
  warningDaysOverride?: number,
): Promise<StockCheckSummary> {
  const env = loadEnv()
  const warningDays = warningDaysOverride ?? env.EXPIRATION_WARNING_DAYS
  const recipients = await getAlertRecipients()

  const [expirationItems, lowStockItems] = await Promise.all([
    findExpirationAlerts(warningDays),
    findLowStockAlerts(),
  ])

  let notificationsCreated = 0

  for (const item of expirationItems) {
    const type: NotificationType =
      item.status === 'EXPIRED' ? 'EXPIRED_MEDICINE' : 'EXPIRATION_WARNING'
    const severity: NotificationSeverity =
      item.status === 'EXPIRED' ? 'CRITICAL' : 'WARNING'
    const title =
      item.status === 'EXPIRED'
        ? `Expired: ${item.medicineName}`
        : `Expiring soon: ${item.medicineName}`
    const message =
      item.status === 'EXPIRED'
        ? `Batch ${item.batchNumber} of ${item.medicineName} expired on ${item.expirationDate.toISOString().slice(0, 10)}. Quantity remaining: ${item.quantity}.`
        : `Batch ${item.batchNumber} of ${item.medicineName} expires on ${item.expirationDate.toISOString().slice(0, 10)} (${item.daysUntilExpiration} day(s) left). Quantity: ${item.quantity}.`

    for (const userId of recipients) {
      const created = await createNotificationIfNeeded({
        userId,
        type,
        title,
        message,
        severity,
        medicineId: item.medicineId,
        batchId: item.batchId,
      })
      if (created) {
        notificationsCreated += 1
      }
    }
  }

  const lowStockMedicineIds = new Set(lowStockItems.map((item) => item.medicineId))

  for (const item of lowStockItems) {
    const title = `Low stock: ${item.medicineName}`
    const message = `${item.medicineName} is below minimum stock. Current: ${item.totalQuantity} ${item.unit}, minimum: ${item.minimumStock} ${item.unit}.`

    for (const userId of recipients) {
      const created = await createNotificationIfNeeded({
        userId,
        type: 'LOW_STOCK',
        title,
        message,
        severity: 'WARNING',
        medicineId: item.medicineId,
        batchId: null,
      })
      if (created) {
        notificationsCreated += 1
      }
    }
  }

  // Resolve unread low-stock notifications when stock is back above minimum.
  const resolveFilter: Record<string, unknown> = {
    type: 'LOW_STOCK',
    isRead: false,
  }

  if (lowStockMedicineIds.size > 0) {
    resolveFilter.relatedMedicine = { $nin: [...lowStockMedicineIds] }
  }

  const resolveResult = await Notification.updateMany(resolveFilter, {
    $set: { isRead: true },
  })

  return {
    checkedAt: new Date().toISOString(),
    warningDays,
    expirationAlerts: expirationItems.length,
    lowStockAlerts: lowStockItems.length,
    notificationsCreated,
    lowStockResolved: resolveResult.modifiedCount,
    recipientCount: recipients.length,
  }
}
