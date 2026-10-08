import type { Types } from 'mongoose'

import { AuditLog } from '../models/index.js'
import type { AuditAction } from '../types/enums.js'

interface CreateAuditLogInput {
  userId?: string | Types.ObjectId | null
  action: AuditAction
  entity: string
  entityId?: string | Types.ObjectId | null | unknown
  description?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/** Best-effort audit write into shared audit_logs collection. Never throws. */
export async function recordAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    await AuditLog.create({
      user: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ? String(input.entityId) : null,
      description: input.description ?? '',
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? '',
    })
  } catch (error) {
    console.error('[audit] failed to record audit log', error)
  }
}
