/**
 * UTC day helpers for consistent report/dashboard date filters.
 * Query dates are interpreted as calendar days in UTC to avoid
 * shifting ranges when the server timezone differs from the client.
 */

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

export function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  )
}

export function parseIsoDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${value}`)
    }
    return parsed
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return new Date(Date.UTC(year, month, day))
}

export interface DateRange {
  from: Date
  to: Date
}

export function resolveDateRange(input: {
  from?: string
  to?: string
  defaultDays?: number
}): DateRange {
  const defaultDays = input.defaultDays ?? 30
  const today = startOfUtcDay(new Date())

  let from: Date
  let to: Date

  if (input.to) {
    to = endOfUtcDay(parseIsoDateOnly(input.to))
  } else {
    to = endOfUtcDay(today)
  }

  if (input.from) {
    from = startOfUtcDay(parseIsoDateOnly(input.from))
  } else {
    from = startOfUtcDay(new Date(today))
    from.setUTCDate(from.getUTCDate() - (defaultDays - 1))
  }

  if (from.getTime() > to.getTime()) {
    throw new Error('from must be before or equal to to')
  }

  return { from, to }
}

export function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
