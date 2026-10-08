import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const medicineSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      maxlength: [200, 'Medicine name cannot exceed 200 characters'],
    },
    genericName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Generic name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    laboratory: {
      type: String,
      trim: true,
      default: '',
      maxlength: [160, 'Laboratory cannot exceed 160 characters'],
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price must be greater than or equal to 0'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price must be greater than or equal to 0'],
    },
    minimumStock: {
      type: Number,
      required: [true, 'Minimum stock is required'],
      min: [0, 'Minimum stock must be greater than or equal to 0'],
      default: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'unit',
      maxlength: [40, 'Unit cannot exceed 40 characters'],
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'medicines',
  },
)

medicineSchema.index({ name: 1 })
medicineSchema.index({ category: 1 })
medicineSchema.index({ supplier: 1 })
medicineSchema.index({ isActive: 1 })

export type MedicineDocument = InferSchemaType<typeof medicineSchema> & {
  _id: Schema.Types.ObjectId
}

export const Medicine: Model<MedicineDocument> =
  (mongoose.models.Medicine as Model<MedicineDocument> | undefined) ??
  model<MedicineDocument>('Medicine', medicineSchema)

export default Medicine
