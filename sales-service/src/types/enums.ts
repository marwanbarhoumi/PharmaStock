export const USER_ROLES = ['ADMIN', 'PHARMACIST', 'EMPLOYEE'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const PAYMENT_METHODS = ['CASH', 'CARD', 'OTHER'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const SALE_STATUSES = ['COMPLETED', 'CANCELLED'] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const PURCHASE_STATUSES = ['PENDING', 'RECEIVED', 'CANCELLED'] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

export const STOCK_MOVEMENT_TYPES = [
  'PURCHASE',
  'SALE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN_IN',
  'RETURN_OUT',
] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const STOCK_REFERENCE_TYPES = ['SALE', 'PURCHASE', 'MANUAL', 'OTHER'] as const
export type StockReferenceType = (typeof STOCK_REFERENCE_TYPES)[number]

export const NOTIFICATION_TYPES = [
  'LOW_STOCK',
  'EXPIRATION_WARNING',
  'EXPIRED_MEDICINE',
  'SYSTEM',
  'OTHER',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]

export const AUDIT_ACTIONS = [
  'CREATE_MEDICINE',
  'UPDATE_MEDICINE',
  'DELETE_MEDICINE',
  'CREATE_SALE',
  'CANCEL_SALE',
  'CREATE_PURCHASE',
  'UPDATE_STOCK',
  'LOGIN',
  'LOGOUT',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
