# PharmaStock Inventory Service

Extracted from the former monolith in Phase 5. Owns batches, stock levels, stock movements,
FEFO allocation and the read-only alert snapshots. Port **5004**.

## Ownership

| Collection | Access |
| --- | --- |
| `batches` | **owner** (all writes) |
| `stock_movements` | **owner** (all writes) |
| `medicines`, `categories` | read-only (aggregations, FEFO checks). Owned by Medicine Service |
| `users` | read-only, only in local JWT fallback (tests). Owned by Auth Service |
| `audit_logs` | append-only `UPDATE_STOCK` entries, same as the monolith did |

Same `pharmastock` database and `mongo_data` volume as every other service. No
collection was created, renamed or dropped.

## Public endpoints (via Gateway, unchanged paths and shapes)

All require `Authorization: Bearer <jwt>`.

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/api/batches` | any authenticated |
| GET | `/api/batches/:id` | any authenticated |
| POST | `/api/batches` | ADMIN, PHARMACIST |
| PUT | `/api/batches/:id` | ADMIN, PHARMACIST |
| DELETE | `/api/batches/:id` (soft: `isActive=false`) | ADMIN, PHARMACIST |
| GET | `/api/stock` | any authenticated |
| GET | `/api/stock/movements` | any authenticated |
| POST | `/api/stock/movements` | ADMIN, PHARMACIST |
| POST | `/api/stock/fefo/allocate` | ADMIN, PHARMACIST |
| GET | `/api/stock/:medicineId` | any authenticated |
| GET | `/api/alerts` | any authenticated |
| GET | `/api/alerts/expiration` | any authenticated |
| GET | `/api/alerts/low-stock` | any authenticated |
| GET | `/api/health` | public |

`POST /api/alerts/check` is **not** here. It creates notifications and is owned
by the Notification Service (Phase 6), and the Gateway routes it there.

Alert shape (unchanged):

```json
{
  "warningDays": 30,
  "expiration": { "warningDays": 30, "items": [] },
  "lowStock": { "items": [] }
}
```

## Internal endpoints (`/internal/inventory/*`, never proxied by the Gateway)

Minimal surface used by the Sales Service, the Purchase Service and the
Notification Service. When `INTERNAL_API_TOKEN` is set, every call must send `x-internal-token`.

| Method | Path | Used by |
| --- | --- | --- |
| POST | `/internal/inventory/fefo/allocate` `{medicineId, quantity}` | Sales Service: sale creation |
| POST | `/internal/inventory/movements` `{medicineId, batchId, type, quantity, reason?, referenceType?, referenceId?, performedBy}` | Sales Service: sale create/cancel + compensation; Purchase Service: receive / `receiveNow` |
| POST | `/internal/inventory/batches` `{medicineId, batchNumber, purchasePrice, expirationDate}` | Purchase Service: purchase creation (quantity 0) |
| DELETE | `/internal/inventory/batches/:id` | Purchase Service: compensation for a failed purchase creation only |
| POST | `/internal/inventory/batches/:id/deactivate-if-empty` | Purchase Service: purchase cancellation |
| GET | `/internal/inventory/alerts?warningDays=N` (same snapshot as `GET /api/alerts`) | Notification Service alert check |
| POST | `/internal/inventory/references` `{medicineIds, batchIds, includePurchasePrice?}` | Notification, Sales and Purchase Service display fields (read-only). `includePurchasePrice` (default `false`) adds batch `purchasePrice` for the purchase detail view |

Errors keep the public format `{ success: false, message, errors }` and status
codes (404 / 409 / 422), and callers re-throw them unchanged.

## FEFO and stock rules (identical to the monolith)

- Eligible batches: `isActive`, `quantity > 0`, `expirationDate >= start of today (UTC)`.
- Order: `expirationDate` ascending, then `_id`. Allocation is greedy across batches.
- Insufficient stock: `409 Insufficient eligible stock for FEFO allocation. Missing N unit(s).`
- Quantity must be a positive integer.
- Movements use one atomic `findOneAndUpdate` with `$inc`. OUT movements add a
  `quantity >= q` guard, so concurrent sales cannot oversell or go negative.
- Every applied movement writes exactly one `stock_movements` record with
  `previousQuantity` / `newQuantity`. If the record insert fails, the
  quantity change is reverted.

## Auth

- `AUTH_SERVICE_URL` set (Docker): every request is introspected via
  `POST {AUTH_SERVICE_URL}/internal/auth/introspect`. Inactive users are rejected.
- Unset (unit tests only): local JWT verification plus a `users.isActive` check.
  `AUTH_SERVICE_URL` is required when `NODE_ENV=production`.

## Environment

See [`.env.example`](.env.example). Key variables: `PORT` (5004), `MONGODB_URI`,
`JWT_SECRET`, `AUTH_SERVICE_URL`, `MEDICINE_SERVICE_URL` (optional catalog
validation on batch create/update), `EXPIRATION_WARNING_DAYS` (30),
`INTERNAL_API_TOKEN` (optional).

## Commands (PowerShell)

```powershell
Set-Location inventory-service
npm install
npm run typecheck
npm test          # MongoMemoryServer, never touches the real database
npm run dev       # needs MongoDB on 127.0.0.1:27017 and a .env
```

## Known limitations

- MongoDB runs standalone in Compose, so there are no transactions. Even with a
  replica set, a caller's transaction cannot include writes made by this
  service. The Sales and Purchase Services therefore use explicit compensation:
  - Failed sale creation: `RETURN_IN` for each applied line, then the sale is deleted.
  - Failed purchase creation: created batches are deleted via the internal DELETE.
  - Failed cancel/receive with nothing applied: the status claim is reverted.
  - Failed cancel/receive after some lines were applied: the status is kept, so a
    retry cannot double-apply. The failure is logged as `PARTIAL CANCEL` /
    `PARTIAL RECEIVE` and the remaining lines need a manual adjustment.
  - Compensation failures are logged as `COMPENSATION FAILED`, and the original
    error is still returned.
- A network timeout after the service has applied a movement is seen as a
  failure by the caller. That movement is not compensated, but its
  `stock_movements` record (with `referenceId`) is kept for reconciliation.
  POSTs are never retried automatically.
