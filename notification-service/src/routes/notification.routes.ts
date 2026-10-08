import { Router } from 'express'

import {
  getNotification,
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from '../controllers/notification.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamSchema } from '../schemas/common.schema.js'
import { notificationListQuerySchema } from '../schemas/notification.schema.js'

const notificationRouter = Router()

notificationRouter.use(authenticate)

notificationRouter.get(
  '/',
  validateRequest({ query: notificationListQuerySchema }),
  listNotifications,
)

notificationRouter.get('/unread-count', getUnreadCount)

notificationRouter.patch('/read-all', markAllAsRead)

notificationRouter.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  getNotification,
)

notificationRouter.patch(
  '/:id/read',
  validateRequest({ params: idParamSchema }),
  markAsRead,
)

export { notificationRouter }
