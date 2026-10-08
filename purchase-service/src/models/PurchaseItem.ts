import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const purchaseItemSchema = new Schema(
  {
    purchase: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      required: [true, 'Purchase is required'],
    },
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
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be greater than 0'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price must be greater than or equal to 0'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price must be greater than or equal to 0'],
    },
  },
  {
    timestamps: true,
    collection: 'purchase_items',
  },
)

purchaseItemSchema.index({ purchase: 1 })
purchaseItemSchema.index({ medicine: 1 })
purchaseItemSchema.index({ batch: 1 })

export type PurchaseItemDocument = InferSchemaType<typeof purchaseItemSchema> & {
  _id: Schema.Types.ObjectId
}

export const PurchaseItem: Model<PurchaseItemDocument> =
  (mongoose.models.PurchaseItem as Model<PurchaseItemDocument> | undefined) ??
  model<PurchaseItemDocument>('PurchaseItem', purchaseItemSchema)

export default PurchaseItem
