import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const saleItemSchema = new Schema(
  {
    sale: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      required: [true, 'Sale is required'],
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
    collection: 'sale_items',
  },
)

saleItemSchema.index({ sale: 1 })
saleItemSchema.index({ medicine: 1 })
saleItemSchema.index({ batch: 1 })

export type SaleItemDocument = InferSchemaType<typeof saleItemSchema> & {
  _id: Schema.Types.ObjectId
}

export const SaleItem: Model<SaleItemDocument> =
  (mongoose.models.SaleItem as Model<SaleItemDocument> | undefined) ??
  model<SaleItemDocument>('SaleItem', saleItemSchema)

export default SaleItem
