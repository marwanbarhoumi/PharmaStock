import type { Request, Response } from 'express'

import type {
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/category.schema.js'
import * as categoryService from '../services/category.service.js'
import { sendCreated, sendSuccess } from '../utils/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await categoryService.getCategories(
    req.query as unknown as CategoryListQuery,
  )
  sendSuccess({
    res,
    message: 'Categories retrieved successfully',
    data: result.items,
    pagination: result.pagination,
  })
})

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryById(req.params.id as string)
  sendSuccess({
    res,
    message: 'Category retrieved successfully',
    data: category,
  })
})

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body as CreateCategoryInput)
  sendCreated(res, 'Category created successfully', category)
})

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(
    req.params.id as string,
    req.body as UpdateCategoryInput,
  )
  sendSuccess({
    res,
    message: 'Category updated successfully',
    data: category,
  })
})

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.deleteCategory(req.params.id as string)
  sendSuccess({
    res,
    message: 'Category deactivated successfully',
    data: category,
  })
})
