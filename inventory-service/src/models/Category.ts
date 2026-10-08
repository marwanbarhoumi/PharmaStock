import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [120, 'Category name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'categories',
  },
)

export type CategoryDocument = InferSchemaType<typeof categorySchema> & {
  _id: Schema.Types.ObjectId
}

export const Category: Model<CategoryDocument> =
  (mongoose.models.Category as Model<CategoryDocument> | undefined) ??
  model<CategoryDocument>('Category', categorySchema)

export default Category
