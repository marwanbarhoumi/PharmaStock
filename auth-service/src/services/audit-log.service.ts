import type { QueryFilter, Types } from 'mongoose'

import { AuditLog, type AuditLogDocument } from '../models/index.js'
import type { AuditLogListQuery } from '../schemas/audit-log.schema.js'
import type { AuditAction } from '../types/enums.js'
import {
  buildPaginationMeta,
  getPagination,
  parseSort,
} from '../utils/pagination.js'

const AUDIT_SORT_FIELDS = ['createdAt'] as const

export async function getAuditLogs(query: AuditLogListQuery) {
  const { page, limit, skip } = getPagination(query)
  const sort = parseSort(query.sort, query.order, AUDIT_SORT_FIELDS, 'createdAt')

  const filter: QueryFilter<AuditLogDocument> = {}

  if (query.user) {
    filter.user = query.user
  }
  if (query.action) {
    filter.action = query.action
  }
  if (query.entity) {
    filter.entity = query.entity
  }
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) {
      filter.createdAt.$gte = query.from
    }
    if (query.to) {
      filter.createdAt.$lte = query.to
    }
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ])

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

interface CreateAuditLogInput {
  userId?: string | Types.ObjectId | null
  action: AuditAction
  entity: string
  entityId?: string | Types.ObjectId | null | unknown
  description?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/** Best-effort audit write. Never throws into business flows. */
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
