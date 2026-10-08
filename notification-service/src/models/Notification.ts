import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

import {
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
} from '../types/enums.js'

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      enum: {
        values: [...NOTIFICATION_TYPES],
        message: 'Invalid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [160, 'Title cannot exceed 160 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    severity: {
      type: String,
      enum: {
        values: [...NOTIFICATION_SEVERITIES],
        message: 'Severity must be INFO, WARNING, or CRITICAL',
      },
      required: [true, 'Severity is required'],
      default: 'INFO',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedMedicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
    },
    relatedBatch: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'notifications',
  },
)

notificationSchema.index({ user: 1 })
notificationSchema.index({ isRead: 1 })
notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({
  user: 1,
  type: 1,
  relatedMedicine: 1,
  relatedBatch: 1,
  isRead: 1,
})

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: Schema.Types.ObjectId
}

export const Notification: Model<NotificationDocument> =
  (mongoose.models.Notification as Model<NotificationDocument> | undefined) ??
  model<NotificationDocument>('Notification', notificationSchema)

export default Notification
