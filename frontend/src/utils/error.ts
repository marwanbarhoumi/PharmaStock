export function formatErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
