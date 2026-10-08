import type { Request, Response } from 'express'

import type {
  CreateSupplierInput,
  SupplierListQuery,
  UpdateSupplierInput,
} from '../schemas/supplier.schema.js'
import * as supplierService from '../services/supplier.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const result = await supplierService.getSuppliers(
    req.query as unknown as SupplierListQuery,
  )
  sendSuccess({
    res,
    message: 'Suppliers retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.getSupplierById(req.params.id as string)
  sendSuccess({
    res,
    message: 'Supplier retrieved successfully',
    data: supplier,
  })
})

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.createSupplier(req.body as CreateSupplierInput)
  sendCreated(res, 'Supplier created successfully', supplier)
})

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.updateSupplier(
    req.params.id as string,
    req.body as UpdateSupplierInput,
  )
  sendSuccess({
    res,
    message: 'Supplier updated successfully',
    data: supplier,
  })
})

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.deleteSupplier(req.params.id as string)
  sendSuccess({
    res,
    message: 'Supplier deactivated successfully',
    data: supplier,
  })
})
