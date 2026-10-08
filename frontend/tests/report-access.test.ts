import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  REPORT_VIEW_ROLES,
  canAccessReports,
  classifyReportHttpStatus,
} from '../src/lib/report-access.ts'

describe('report access permissions', () => {
  it('allows ADMIN and PHARMACIST only', () => {
    assert.deepEqual([...REPORT_VIEW_ROLES], ['ADMIN', 'PHARMACIST'])
    assert.equal(canAccessReports('ADMIN'), true)
    assert.equal(canAccessReports('PHARMACIST'), true)
    assert.equal(canAccessReports('EMPLOYEE'), false)
    assert.equal(canAccessReports(null), false)
    assert.equal(canAccessReports(undefined), false)
  })

  it('classifies 401 and 403 for report API responses', () => {
    assert.equal(classifyReportHttpStatus(403), 'forbidden')
    assert.equal(classifyReportHttpStatus(401), 'unauthorized')
    assert.equal(classifyReportHttpStatus(500), 'other')
    assert.equal(classifyReportHttpStatus(undefined), 'other')
  })
})
