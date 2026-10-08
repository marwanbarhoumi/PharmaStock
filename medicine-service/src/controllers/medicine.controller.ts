import type { Request, Response } from 'express'

import type {
  MedicineListQuery,
  CreateMedicineInput,
  UpdateMedicineInput,
} from '../schemas/medicine.schema.js'
import { recordAuditLog } from '../services/audit-log.service.js'
import * as medicineService from '../services/medicine.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const listMedicines = asyncHandler(async (req: Request, res: Response) => {
  const result = await medicineService.getMedicines(
    req.query as unknown as MedicineListQuery,
  )
  sendSuccess({
    res,
    message: 'Medicines retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getMedicine = asyncHandler(async (req: Request, res: Response) => {
  const medicine = await medicineService.getMedicineById(req.params.id as string)
  sendSuccess({
    res,
    message: 'Medicine retrieved successfully',
    data: medicine,
  })
})

export const getMedicineByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const medicine = await medicineService.getMedicineByBarcode(
    req.params.barcode as string,
  )
  sendSuccess({
    res,
    message: 'Medicine retrieved by barcode successfully',
    data: medicine,
  })
})

export const createMedicine = asyncHandler(async (req: Request, res: Response) => {
  const medicine = await medicineService.createMedicine(
    req.body as CreateMedicineInput,
  )
  void recordAuditLog({
    userId: req.user?.id,
    action: 'CREATE_MEDICINE',
    entity: 'Medicine',
    entityId: medicine?._id ? String(medicine._id) : null,
    description: `Medicine ${medicine?.name ?? ''} created`,
    ipAddress: req.ip,
  })
  sendCreated(res, 'Medicine created successfully', medicine)
})

export const updateMedicine = asyncHandler(async (req: Request, res: Response) => {
  const medicine = await medicineService.updateMedicine(
    req.params.id as string,
    req.body as UpdateMedicineInput,
  )
  void recordAuditLog({
    userId: req.user?.id,
    action: 'UPDATE_MEDICINE',
    entity: 'Medicine',
    entityId: medicine?._id ? String(medicine._id) : null,
    description: `Medicine ${medicine?.name ?? ''} updated`,
    ipAddress: req.ip,
  })
  sendSuccess({
    res,
    message: 'Medicine updated successfully',
    data: medicine,
  })
})

export const deleteMedicine = asyncHandler(async (req: Request, res: Response) => {
  const medicine = await medicineService.deleteMedicine(req.params.id as string)
  void recordAuditLog({
    userId: req.user?.id,
    action: 'DELETE_MEDICINE',
    entity: 'Medicine',
    entityId: medicine?._id ? String(medicine._id) : null,
    description: `Medicine ${medicine?.name ?? ''} deactivated`,
    ipAddress: req.ip,
  })
  sendSuccess({
    res,
    message: 'Medicine deactivated successfully',
    data: medicine,
  })
})
