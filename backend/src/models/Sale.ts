import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

import { PAYMENT_METHODS, SALE_STATUSES } from '../types/enums.js'

const saleSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [160, 'Customer name cannot exceed 160 characters'],
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SaleItem',
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
    paymentMethod: {
      type: String,
      enum: {
        values: [...PAYMENT_METHODS],
        message: 'Payment method must be CASH, CARD, or OTHER',
      },
      required: [true, 'Payment method is required'],
      default: 'CASH',
    },
    status: {
      type: String,
      enum: {
        values: [...SALE_STATUSES],
        message: 'Status must be COMPLETED or CANCELLED',
      },
      required: [true, 'Status is required'],
      default: 'COMPLETED',
    },
    soldBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'soldBy is required'],
    },
  },
  {
    timestamps: true,
    collection: 'sales',
  },
)

saleSchema.index({ createdAt: -1 })
saleSchema.index({ soldBy: 1 })
saleSchema.index({ status: 1 })

export type SaleDocument = InferSchemaType<typeof saleSchema> & {
  _id: Schema.Types.ObjectId
}

export const Sale: Model<SaleDocument> =
  (mongoose.models.Sale as Model<SaleDocument> | undefined) ??
  model<SaleDocument>('Sale', saleSchema)

export default Sale
