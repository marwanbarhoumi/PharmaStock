import type { Request, Response } from 'express'

import type { NotificationListQuery } from '../schemas/notification.schema.js'
import * as notificationService from '../services/notification.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'
import { unauthorized } from '../utils/app-error.js'

function requireUserId(req: Request): string {
  if (!req.user) {
    throw unauthorized()
  }
  return req.user.id
}

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req)
  const result = await notificationService.getNotificationsForUser(
    userId,
    req.query as unknown as NotificationListQuery,
  )
  sendSuccess({
    res,
    message: 'Notifications retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req)
  const result = await notificationService.getUnreadNotificationCount(userId)
  sendSuccess({
    res,
    message: 'Unread notification count retrieved successfully',
    data: result,
  })
})

export const getNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req)
  const notification = await notificationService.getNotificationByIdForUser(
    req.params.id as string,
    userId,
  )
  sendSuccess({
    res,
    message: 'Notification retrieved successfully',
    data: notification,
  })
})

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req)
  const notification = await notificationService.markNotificationAsRead(
    req.params.id as string,
    userId,
  )
  sendSuccess({
    res,
    message: 'Notification marked as read',
    data: notification,
  })
})

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req)
  const result = await notificationService.markAllNotificationsAsRead(userId)
  sendSuccess({
    res,
    message: 'All notifications marked as read',
    data: result,
  })
})
