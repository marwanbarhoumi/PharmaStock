import type { QueryFilter } from 'mongoose'

import { Notification, type NotificationDocument } from '../models/index.js'
import type { NotificationListQuery } from '../schemas/notification.schema.js'
import { forbidden, notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'
import { fetchReferences } from './inventory-client.js'

const NOTIFICATION_SORT_FIELDS = ['createdAt'] as const

type LeanNotification = Record<string, unknown> & {
  relatedMedicine?: unknown
  relatedBatch?: unknown
}

/**
 * Replaces relatedMedicine / relatedBatch ids with the same objects the monolith
 * produced via populate ('name barcode' and 'batchNumber expirationDate quantity').
 * Missing references become null, like populate. If Inventory is unreachable the
 * list is still returned with `{ _id }` placeholders so notifications stay visible.
 */
async function hydrateReferences<T extends LeanNotification>(items: T[]): Promise<T[]> {
  const medicineIds = new Set<string>()
  const batchIds = new Set<string>()
  for (const item of items) {
    if (item.relatedMedicine) medicineIds.add(String(item.relatedMedicine))
    if (item.relatedBatch) batchIds.add(String(item.relatedBatch))
  }

  if (medicineIds.size === 0 && batchIds.size === 0) {
    return items
  }

  let medicines: Map<string, unknown> | null = null
  let batches: Map<string, unknown> | null = null
  try {
    const refs = await fetchReferences([...medicineIds], [...batchIds])
    medicines = new Map(refs.medicines.map((m) => [String(m._id), m]))
    batches = new Map(refs.batches.map((b) => [String(b._id), b]))
  } catch (error) {
    console.error('[notification] Could not resolve medicine/batch references', error)
  }

  return items.map((item) => {
    const next: LeanNotification = { ...item }
    if (item.relatedMedicine) {
      const id = String(item.relatedMedicine)
      next.relatedMedicine = medicines ? (medicines.get(id) ?? null) : { _id: id }
    }
    if (item.relatedBatch) {
      const id = String(item.relatedBatch)
      next.relatedBatch = batches ? (batches.get(id) ?? null) : { _id: id }
    }
    return next as T
  })
}

async function hydrateOne<T extends LeanNotification>(item: T): Promise<T> {
  const [hydrated] = await hydrateReferences([item])
  return hydrated as T
}

export async function getNotificationsForUser(
  userId: string,
  query: NotificationListQuery,
) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(
    query.sort,
    query.order,
    NOTIFICATION_SORT_FIELDS,
    'createdAt',
  )

  const filter: QueryFilter<NotificationDocument> = {
    user: userId,
  }

  if (query.type) {
    filter.type = query.type
  }
  if (query.severity) {
    filter.severity = query.severity
  }
  if (query.isRead !== undefined) {
    filter.isRead = query.isRead
  }

  const [items, total] = await Promise.all([
    Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ])

  return {
    items: await hydrateReferences(items as unknown as LeanNotification[]),
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getNotificationByIdForUser(id: string, userId: string) {
  const notification = await Notification.findById(id).lean()

  if (!notification) {
    throw notFound('Notification')
  }

  if (String(notification.user) !== userId) {
    throw forbidden('You can only access your own notifications')
  }

  return hydrateOne(notification as unknown as LeanNotification)
}

export async function getUnreadNotificationCount(userId: string) {
  const count = await Notification.countDocuments({
    user: userId,
    isRead: false,
  })

  return { count }
}

export async function markNotificationAsRead(id: string, userId: string) {
  const notification = await Notification.findById(id)

  if (!notification) {
    throw notFound('Notification')
  }

  if (String(notification.user) !== userId) {
    throw forbidden('You can only update your own notifications')
  }

  if (!notification.isRead) {
    notification.isRead = true
    await notification.save()
  }

  const updated = await Notification.findById(id).lean()
  return updated ? hydrateOne(updated as unknown as LeanNotification) : null
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true } },
  )

  return { modifiedCount: result.modifiedCount }
}
