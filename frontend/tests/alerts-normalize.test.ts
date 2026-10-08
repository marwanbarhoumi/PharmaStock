import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeAlertsSnapshot } from '../src/lib/alerts.ts'

describe('normalizeAlertsSnapshot', () => {
  it('accepts nested items shape from fixed API', () => {
    const snapshot = normalizeAlertsSnapshot({
      warningDays: 30,
      expiration: {
        warningDays: 30,
        items: [
          {
            medicineId: 'm1',
            medicineName: 'Para',
            batchId: 'b1',
            batchNumber: 'B-1',
            quantity: 2,
            expirationDate: '2020-01-01',
            daysUntilExpiration: -10,
            status: 'EXPIRED',
          },
        ],
      },
      lowStock: {
        items: [
          {
            medicineId: 'm2',
            medicineName: 'Amox',
            minimumStock: 10,
            totalQuantity: 1,
            deficit: 9,
          },
        ],
      },
    })

    assert.equal(snapshot.expiration.items.length, 1)
    assert.equal(snapshot.lowStock.items.length, 1)
    assert.equal(snapshot.lowStock.items[0]?.medicineName, 'Amox')
  })

  it('accepts legacy flat array shape without crashing', () => {
    const snapshot = normalizeAlertsSnapshot({
      warningDays: 14,
      expiration: [],
      lowStock: [
        {
          medicineId: 'm3',
          medicineName: 'VitC',
          minimumStock: 5,
          totalQuantity: 0,
          deficit: 5,
        },
      ],
    })

    assert.equal(snapshot.warningDays, 14)
    assert.deepEqual(snapshot.expiration.items, [])
    assert.equal(snapshot.lowStock.items.length, 1)
  })

  it('handles nullish payloads safely', () => {
    const snapshot = normalizeAlertsSnapshot(undefined)
    assert.equal(snapshot.lowStock.items.length, 0)
    assert.equal(snapshot.expiration.items.length, 0)
  })
})
