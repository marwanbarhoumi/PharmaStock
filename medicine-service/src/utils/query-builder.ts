import type { QueryFilter } from 'mongoose'

/**
 * Builds a safe $or text search across allowed string fields.
 * Does not accept arbitrary Mongo operators from the client.
 */
export function buildTextSearch<T>(
  search: string | undefined,
  fields: readonly string[],
): QueryFilter<T> {
  const term = search?.trim()
  if (!term || fields.length === 0) {
    return {}
  }

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'i')

  return {
    $or: fields.map((field) => ({ [field]: regex })),
  } as QueryFilter<T>
}

export function omitUndefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}
