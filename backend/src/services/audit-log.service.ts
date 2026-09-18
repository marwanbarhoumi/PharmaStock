import type { QueryFilter } from 'mongoose'

import { AuditLog, type AuditLogDocument } from '../models/index.js'
import type { AuditLogListQuery } from '../schemas/audit-log.schema.js'
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
