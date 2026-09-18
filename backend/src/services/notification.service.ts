import type { QueryFilter } from 'mongoose'

import { Notification, type NotificationDocument } from '../models/index.js'
import type { NotificationListQuery } from '../schemas/notification.schema.js'
import { forbidden, notFound } from '../utils/app-error.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'

const NOTIFICATION_SORT_FIELDS = ['createdAt'] as const

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
    Notification.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('relatedMedicine', 'name barcode')
      .populate('relatedBatch', 'batchNumber expirationDate quantity')
      .lean(),
    Notification.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

export async function getNotificationByIdForUser(id: string, userId: string) {
  const notification = await Notification.findById(id)
    .populate('relatedMedicine', 'name barcode')
    .populate('relatedBatch', 'batchNumber expirationDate quantity')
    .lean()

  if (!notification) {
    throw notFound('Notification')
  }

  if (String(notification.user) !== userId) {
    throw forbidden('You can only access your own notifications')
  }

  return notification
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

  return Notification.findById(id)
    .populate('relatedMedicine', 'name barcode')
    .populate('relatedBatch', 'batchNumber expirationDate quantity')
    .lean()
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true } },
  )

  return { modifiedCount: result.modifiedCount }
}
