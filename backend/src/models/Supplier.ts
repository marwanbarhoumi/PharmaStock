import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const supplierSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: [160, 'Supplier name cannot exceed 160 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
      match: [/^\S+@\S+\.\S+$/, 'Email must be a valid email address'],
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Address cannot exceed 300 characters'],
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
      maxlength: [120, 'Contact person cannot exceed 120 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'suppliers',
  },
)

supplierSchema.index({ name: 1 })
supplierSchema.index({ isActive: 1 })

export type SupplierDocument = InferSchemaType<typeof supplierSchema> & {
  _id: Schema.Types.ObjectId
}

export const Supplier: Model<SupplierDocument> =
  (mongoose.models.Supplier as Model<SupplierDocument> | undefined) ??
  model<SupplierDocument>('Supplier', supplierSchema)

export default Supplier
