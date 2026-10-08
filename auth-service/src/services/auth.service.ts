import { User } from '../models/index.js'
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js'
import { loadEnv } from '../config/env.js'
import {
  conflict,
  unauthorized,
  forbidden,
} from '../utils/app-error.js'
import { signAccessToken } from '../utils/jwt.js'
import { comparePassword, hashPassword } from '../utils/password.js'
import { toSafeUser, type AuthUser } from '../utils/user-mapper.js'

export interface AuthResult {
  user: AuthUser
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: string
}

function buildAuthResult(user: AuthUser): AuthResult {
  const env = loadEnv()
  const accessToken = signAccessToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN,
  )

  return {
    user,
    accessToken,
    tokenType: 'Bearer',
    expiresIn: env.JWT_EXPIRES_IN,
  }
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email }).select('_id')
  if (existing) {
    throw conflict('An account with this email already exists')
  }

  const passwordHash = await hashPassword(input.password)

  const created = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: passwordHash,
    phone: input.phone,
    // Public registration always creates EMPLOYEE — never ADMIN.
    role: 'EMPLOYEE',
    isActive: true,
  })

  return buildAuthResult(toSafeUser(created))
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+password')

  if (!user || !user.password) {
    throw unauthorized('Invalid email or password')
  }

  if (user.isActive === false) {
    throw forbidden('This account has been deactivated')
  }

  const isValid = await comparePassword(input.password, user.password)
  if (!isValid) {
    throw unauthorized('Invalid email or password')
  }

  return buildAuthResult(toSafeUser(user))
}

export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await User.findById(userId)

  if (!user || user.isActive === false) {
    throw unauthorized('Authentication required')
  }

  return toSafeUser(user)
}
