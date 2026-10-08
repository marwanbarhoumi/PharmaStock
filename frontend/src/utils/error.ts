import axios from 'axios'

type ApiErrorPayload = {
  message?: string
  errors?: Array<{ path?: string; message?: string }>
}

function formatValidationDetails(errors: ApiErrorPayload['errors']): string | null {
  if (!errors?.length) return null
  const details = errors
    .map((item) => {
      const path = item.path?.trim()
      const message = item.message?.trim()
      if (path && message) return `${path}: ${message}`
      return message || path || null
    })
    .filter((value): value is string => Boolean(value))
  return details.length > 0 ? details.join(' · ') : null
}

export function formatErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiErrorPayload | undefined
    const details = formatValidationDetails(payload?.errors)
    if (payload?.message && details) {
      return `${payload.message} (${details})`
    }
    if (payload?.message) {
      return payload.message
    }
    if (details) {
      return details
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

/** @deprecated Prefer formatErrorMessage */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  return formatErrorMessage(error, fallback)
}
