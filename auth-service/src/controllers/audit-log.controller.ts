import type { Request, Response } from 'express'

import type { AuditLogListQuery } from '../schemas/audit-log.schema.js'
import * as auditLogService from '../services/audit-log.service.js'
import { sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditLogService.getAuditLogs(
    req.query as unknown as AuditLogListQuery,
  )
  sendSuccess({
    res,
    message: 'Audit logs retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})
