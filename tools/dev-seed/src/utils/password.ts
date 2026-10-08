import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}
