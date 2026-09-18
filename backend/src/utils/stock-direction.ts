import type { StockMovementType } from '../types/enums.js'
import { badRequest } from './app-error.js'

export type StockDirection = 'IN' | 'OUT'

const MOVEMENT_DIRECTIONS: Record<StockMovementType, StockDirection> = {
  PURCHASE: 'IN',
  ADJUSTMENT_IN: 'IN',
  RETURN_IN: 'IN',
  SALE: 'OUT',
  ADJUSTMENT_OUT: 'OUT',
  RETURN_OUT: 'OUT',
}

export function getStockDirection(type: StockMovementType): StockDirection {
  const direction = MOVEMENT_DIRECTIONS[type]
  if (!direction) {
    throw badRequest(`Unsupported stock movement type: ${type}`)
  }
  return direction
}

export function isInboundMovement(type: StockMovementType): boolean {
  return getStockDirection(type) === 'IN'
}
