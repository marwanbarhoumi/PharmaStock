import type { Env } from '../config/env.js'
import { runStockChecks } from './stock-check.service.js'

let schedulerStarted = false
let checkInProgress = false
let intervalHandle: ReturnType<typeof setInterval> | null = null

async function runGuardedStockCheck(): Promise<void> {
  if (checkInProgress) {
    return
  }

  checkInProgress = true
  try {
    await runStockChecks()
  } catch (error: unknown) {
    console.error('[stock-check] Scheduled stock check failed', error)
  } finally {
    checkInProgress = false
  }
}

/**
 * Starts a single process-wide stock-check interval.
 * Skipped in test mode, when disabled, or if already started.
 */
export function startStockCheckScheduler(env: Env): void {
  if (schedulerStarted) {
    return
  }
  if (env.NODE_ENV === 'test' || !env.STOCK_CHECK_ENABLED) {
    return
  }

  schedulerStarted = true

  intervalHandle = setInterval(() => {
    void runGuardedStockCheck()
  }, env.STOCK_CHECK_INTERVAL_MS)

  // Avoid keeping the process alive solely because of the timer in some runtimes.
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref()
  }

  console.log(
    `[stock-check] Scheduler started (interval ${env.STOCK_CHECK_INTERVAL_MS}ms, warning ${env.EXPIRATION_WARNING_DAYS}d)`,
  )
}

export function stopStockCheckScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  schedulerStarted = false
  checkInProgress = false
}

/** Test/helper access to overlap guard state. */
export function isStockCheckRunning(): boolean {
  return checkInProgress
}

export function isStockCheckSchedulerStarted(): boolean {
  return schedulerStarted
}
