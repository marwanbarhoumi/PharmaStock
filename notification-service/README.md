# PharmaStock Notification Service

Extracted from the former monolith in Phase 6. Owns user notifications, read/unread state,
alert-check orchestration and the scheduled stock check. Port **5005**.

## Ownership

| Collection | Access |
| --- | --- |
| `notifications` | **owner** (all writes). Existing collection and documents, unchanged schema |
| `users` | read-only: alert recipients (active ADMIN/PHARMACIST) and the local JWT fallback in tests. Owned by Auth Service |

The service never reads or writes `batches`, `medicines` or `stock_movements`.
Alert data and display fields come from the Inventory Service over HTTP.

## Public endpoints (via Gateway, unchanged contract)

All require `Authorization: Bearer <jwt>`. Notifications are scoped to the caller.

| Method | Path | Roles | Response `data` |
| --- | --- | --- | --- |
| GET | `/api/notifications` (`page`, `limit`, `type`, `severity`, `isRead`, `sort`, `order`) | any authenticated | `Notification[]` + top-level `pagination` |
| GET | `/api/notifications/unread-count` | any authenticated | `{ count }` |
| PATCH | `/api/notifications/read-all` | any authenticated (own only) | `{ modifiedCount }` |
| GET | `/api/notifications/:id` | owner only (else 403) | `Notification` |
| PATCH | `/api/notifications/:id/read` | owner only (else 403) | `Notification` |
| POST | `/api/alerts/check` | ADMIN, PHARMACIST | `{ checkedAt, warningDays, expirationAlerts, lowStockAlerts, notificationsCreated, lowStockResolved, recipientCount }` |
| GET | `/api/health` | public | |

`relatedMedicine` (`{_id, name, barcode}`) and `relatedBatch`
(`{_id, batchNumber, expirationDate, quantity}`) are returned exactly as the
monolith's `populate` did. They are resolved with one batched Inventory call
per request. A reference that no longer exists becomes `null`. If Inventory is
unreachable, the list is still returned with `{ _id }` placeholders.

`GET /api/alerts`, `/api/alerts/expiration` and `/api/alerts/low-stock` stay with
the Inventory Service.

## Inventory dependency (internal, never through the Gateway)

| Call | Purpose |
| --- | --- |
| `GET {INVENTORY_SERVICE_URL}/internal/inventory/alerts?warningDays=N` | Same snapshot as `GET /api/alerts` (Inventory's existing alert logic) |
| `POST {INVENTORY_SERVICE_URL}/internal/inventory/references` `{medicineIds, batchIds}` | Display fields for notification references |

The `x-internal-token` header is sent when `INTERNAL_API_TOKEN` is set, using the
same pattern as Sales/Purchase → Inventory.

## Alert check and deduplication (identical to the monolith)

1. Fetch the alert snapshot from Inventory **before any write**. If Inventory is
   unavailable, the check returns `503 Inventory Service unavailable` and creates nothing.
2. Recipients: users with `isActive: true` and role `ADMIN` or `PHARMACIST`.
3. For each expiration item (`EXPIRED_MEDICINE`/CRITICAL or `EXPIRATION_WARNING`/WARNING)
   and each low-stock item (`LOW_STOCK`/WARNING), for each recipient: create a
   notification **only if no unread notification exists** with the same
   `user + type + relatedMedicine + relatedBatch` (`relatedBatch: null` for low stock).
   Titles and messages are the same text as before.
4. Unread `LOW_STOCK` notifications for medicines no longer reported as low are
   marked read (`lowStockResolved`).

Consequences, all unchanged from the monolith:
- Repeating a check without a state change creates nothing.
- After a user marks an alert read, a still-active alert is notified again on the next check.

Runs are serialized in-process, so a manual check and the scheduler cannot
interleave and create duplicates. If a write fails partway, the notifications
already created are kept, the failure is logged, and the error is returned. A
retry skips the existing ones through deduplication. No automatic retries.

## Scheduler

This service runs the **only** alert-check scheduler. It uses the same variables
and defaults the monolith used:
- `STOCK_CHECK_ENABLED` (default `true`)
- `STOCK_CHECK_INTERVAL_MS` (default `3600000`, minimum `60000`)
- `EXPIRATION_WARNING_DAYS` (default `30`)

The scheduler is skipped when `NODE_ENV=test`.

No other service runs an alert-check scheduler.

## Auth

Every request is introspected through `POST {AUTH_SERVICE_URL}/internal/auth/introspect`,
and inactive users get 401. Without `AUTH_SERVICE_URL` (unit tests only), the
service verifies the JWT locally and checks `users.isActive`. `AUTH_SERVICE_URL`
is required in production.

## Commands (PowerShell)

```powershell
Set-Location notification-service
npm install
npm run typecheck
npm test          # MongoMemoryServer + mock Auth/Inventory, never touches the real DB
npm run dev       # needs MongoDB, Auth (:5002) and Inventory (:5004), plus a .env
```

## Known limitations

- Deduplication is check-then-insert with no unique index; it is guarded only by
  in-process serialization. Run a **single replica** of this service.
- Recipients are read from the shared `users` collection, not through an Auth API.
