import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import axios from 'axios'

import { formatErrorMessage } from '../src/utils/error.ts'

describe('formatErrorMessage', () => {
  it('includes validation details from API errors', () => {
    const error = new axios.AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as never,
        data: {
          success: false,
          message: 'Validation failed',
          errors: [{ path: 'limit', message: 'Too big: expected number to be <=100' }],
        },
      },
    )

    assert.equal(
      formatErrorMessage(error, 'fallback'),
      'Validation failed (limit: Too big: expected number to be <=100)',
    )
  })

  it('falls back when no response body is present', () => {
    assert.equal(formatErrorMessage(new Error('boom'), 'fallback'), 'boom')
    assert.equal(formatErrorMessage({}, 'fallback'), 'fallback')
  })
})
