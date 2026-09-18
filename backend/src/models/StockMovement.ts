import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

import {
  STOCK_MOVEMENT_TYPES,
  STOCK_REFERENCE_TYPES,
} from '../types/enums.js'

const stockMovementSchema = new Schema(
  {
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine is required'],
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch is required'],
    },
    type: {
      type: String,
      enum: {
        values: [...STOCK_MOVEMENT_TYPES],
        message: 'Invalid stock movement type',
      },
      required: [true, 'Movement type is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be greater than 0'],
    },
    previousQuantity: {
      type: Number,
      required: [true, 'Previous quantity is required'],
      min: [0, 'Previous quantity must be greater than or equal to 0'],
    },
    newQuantity: {
      type: Number,
      required: [true, 'New quantity is required'],
      min: [0, 'New quantity must be greater than or equal to 0'],
    },
    reason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    referenceType: {
      type: String,
      enum: {
        values: [...STOCK_REFERENCE_TYPES],
        message: 'Invalid reference type',
      },
      required: [true, 'Reference type is required'],
      default: 'OTHER',
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'performedBy is required'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'stock_movements',
  },
)

stockMovementSchema.index({ medicine: 1 })
stockMovementSchema.index({ batch: 1 })
stockMovementSchema.index({ createdAt: -1 })
stockMovementSchema.index({ type: 1 })
stockMovementSchema.index({ medicine: 1, createdAt: -1 })

export type StockMovementDocument = InferSchemaType<typeof stockMovementSchema> & {
  _id: Schema.Types.ObjectId
}

export const StockMovement: Model<StockMovementDocument> =
  (mongoose.models.StockMovement as Model<StockMovementDocument> | undefined) ??
  model<StockMovementDocument>('StockMovement', stockMovementSchema)

export default StockMovement
