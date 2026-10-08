import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const batchSchema = new Schema(
  {
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine is required'],
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      maxlength: [80, 'Batch number cannot exceed 80 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity must be greater than or equal to 0'],
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price must be greater than or equal to 0'],
    },
    expirationDate: {
      type: Date,
      required: [true, 'Expiration date is required'],
    },
    receivedDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'batches',
  },
)

batchSchema.index({ medicine: 1 })
batchSchema.index({ expirationDate: 1 })
batchSchema.index({ batchNumber: 1 })
batchSchema.index(
  { medicine: 1, batchNumber: 1 },
  { unique: true, name: 'unique_medicine_batch_number' },
)

export type BatchDocument = InferSchemaType<typeof batchSchema> & {
  _id: Schema.Types.ObjectId
}

export const Batch: Model<BatchDocument> =
  (mongoose.models.Batch as Model<BatchDocument> | undefined) ??
  model<BatchDocument>('Batch', batchSchema)

export default Batch
