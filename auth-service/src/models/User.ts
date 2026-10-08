import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

import { USER_ROLES } from '../types/enums.js'

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [80, 'First name cannot exceed 80 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [80, 'Last name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email must be a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: [...USER_ROLES],
        message: 'Role must be ADMIN, PHARMACIST, or EMPLOYEE',
      },
      required: [true, 'Role is required'],
      default: 'EMPLOYEE',
    },
    phone: {
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
    collection: 'users',
  },
)

userSchema.index({ role: 1 })
userSchema.index({ isActive: 1 })

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Schema.Types.ObjectId
}

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  model<UserDocument>('User', userSchema)

export default User
