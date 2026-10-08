import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

import { AUDIT_ACTIONS } from '../types/enums.js'

const auditLogSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      enum: {
        values: [...AUDIT_ACTIONS],
        message: 'Invalid audit action',
      },
      required: [true, 'Action is required'],
    },
    entity: {
      type: String,
      required: [true, 'Entity is required'],
      trim: true,
      maxlength: [80, 'Entity cannot exceed 80 characters'],
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
  },
)

auditLogSchema.index({ user: 1 })
auditLogSchema.index({ action: 1 })
auditLogSchema.index({ entity: 1, entityId: 1 })
auditLogSchema.index({ createdAt: -1 })

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & {
  _id: Schema.Types.ObjectId
}

export const AuditLog: Model<AuditLogDocument> =
  (mongoose.models.AuditLog as Model<AuditLogDocument> | undefined) ??
  model<AuditLogDocument>('AuditLog', auditLogSchema)

export default AuditLog
