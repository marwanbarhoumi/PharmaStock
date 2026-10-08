/** Matches backend `report.routes.ts` and README RBAC matrix. */
export const REPORT_VIEW_ROLES = ['ADMIN', 'PHARMACIST'] as const

export type ReportViewerRole = (typeof REPORT_VIEW_ROLES)[number]

export function canAccessReports(role: string | null | undefined): boolean {
  return (
    role === 'ADMIN' ||
    role === 'PHARMACIST'
  )
}

export type ReportHttpErrorKind = 'forbidden' | 'unauthorized' | 'other'

/**
 * Map report API HTTP status to UI handling.
 * 403 = role restriction; 401 = missing/invalid/expired token.
 */
export function classifyReportHttpStatus(
  status: number | undefined,
): ReportHttpErrorKind {
  if (status === 403) return 'forbidden'
  if (status === 401) return 'unauthorized'
  return 'other'
}
