import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

import { PURCHASE_STATUSES } from '../types/enums.js'

const purchaseSchema = new Schema(
  {
    purchaseNumber: {
      type: String,
      required: [true, 'Purchase number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PurchaseItem',
      },
    ],
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal must be greater than or equal to 0'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount must be greater than or equal to 0'],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax must be greater than or equal to 0'],
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total must be greater than or equal to 0'],
    },
    status: {
      type: String,
      enum: {
        values: [...PURCHASE_STATUSES],
        message: 'Status must be PENDING, RECEIVED, or CANCELLED',
      },
      required: [true, 'Status is required'],
      default: 'PENDING',
    },
    purchasedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'purchasedBy is required'],
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'purchases',
  },
)

purchaseSchema.index({ supplier: 1 })
purchaseSchema.index({ purchaseDate: -1 })
purchaseSchema.index({ purchasedBy: 1 })
purchaseSchema.index({ status: 1 })

export type PurchaseDocument = InferSchemaType<typeof purchaseSchema> & {
  _id: Schema.Types.ObjectId
}

export const Purchase: Model<PurchaseDocument> =
  (mongoose.models.Purchase as Model<PurchaseDocument> | undefined) ??
  model<PurchaseDocument>('Purchase', purchaseSchema)

export default Purchase
