export const USER_ROLES = ['ADMIN', 'PHARMACIST', 'EMPLOYEE'] as const
export type UserRole = (typeof USER_ROLES)[number]
