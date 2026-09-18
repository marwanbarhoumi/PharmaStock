import type { Request, Response } from 'express'

import type {
  BatchListQuery,
  CreateBatchInput,
  UpdateBatchInput,
} from '../schemas/batch.schema.js'
import * as batchService from '../services/batch.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const listBatches = asyncHandler(async (req: Request, res: Response) => {
  const result = await batchService.getBatches(req.query as unknown as BatchListQuery)
  sendSuccess({
    res,
    message: 'Batches retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getBatch = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchService.getBatchById(req.params.id as string)
  sendSuccess({
    res,
    message: 'Batch retrieved successfully',
    data: batch,
  })
})

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchService.createBatch(req.body as CreateBatchInput)
  sendCreated(res, 'Batch created successfully', batch)
})

export const updateBatch = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchService.updateBatch(
    req.params.id as string,
    req.body as UpdateBatchInput,
  )
  sendSuccess({
    res,
    message: 'Batch updated successfully',
    data: batch,
  })
})

export const deleteBatch = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchService.deleteBatch(req.params.id as string)
  sendSuccess({
    res,
    message: 'Batch deactivated successfully',
    data: batch,
  })
})
