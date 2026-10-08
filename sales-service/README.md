# PharmaStock Sales Service

Extracted from the former monolith in Phase 7. Owns sales, sale items, sale creation,
retrieval and cancellation. Port **5006**.

Stock is never changed here: every stock change is an Inventory Service
movement, and FEFO plans come from the Inventory Service.

## Ownership

| Collection | Access |
| --- | --- |
| `sales` | **owner** (all writes). Existing collection, documents and ids unchanged |
| `sale_items` | **owner** (all writes). Existing collection, documents and ids unchanged |
| `users` | read-only populate of `soldBy` (`firstName lastName email [role]`). Owned by Auth Service |
| `audit_logs` | best-effort append of `CREATE_SALE` / `CANCEL_SALE`, same mechanism as the other services. Owned by Auth Service |

Never accessed: `batches`, `stock_movements`, `medicines`, `notifications`.
The Reporting Service reads `sales` and `sale_items` read-only for the dashboard and reports.

## Public endpoints (via Gateway, unchanged contract)

All require `Authorization: Bearer <jwt>` (Auth Service introspection).

| Method | Path | Roles | Response |
| --- | --- | --- | --- |
| GET | `/api/sales` (`page`, `limit`, `search`, `status`, `soldBy`, `sort`, `order`) | any authenticated | `Sale[]` + `pagination` |
| POST | `/api/sales` | ADMIN, PHARMACIST, EMPLOYEE | 201 `Sale` |
| GET | `/api/sales/:id` | any authenticated | `Sale` |
| POST | `/api/sales/:id/cancel` | ADMIN, PHARMACIST | `Sale` |
| GET | `/api/health` | public | |

Validation, messages and status codes are the monolith's:
- 422 for invalid bodies or queries.
- 404 `Medicine not found` (missing or inactive) and 404 `Sale not found`.
- 409 for insufficient FEFO stock, `Sale is already cancelled` and `Sale cannot be cancelled`.

Populated fields match the monolith:
- **List view:** medicine `name barcode`; batch `batchNumber expirationDate`.
- **Detail view:** medicine `name barcode unit sellingPrice`; batch `batchNumber expirationDate quantity`.

A reference that no longer exists becomes `null`. If an owner service is down,
reads still succeed with `{ _id }` placeholders.

## Internal dependencies (Docker network only, never via Gateway)

| Service | Call | Use |
| --- | --- | --- |
| Auth `:5002` | `POST /internal/auth/introspect` | identity, role, isActive |
| Medicine `:5003` | `GET /internal/catalog/medicines/:id` | sale validation (`isActive`, `sellingPrice`) and display fields |
| Inventory `:5004` | `POST /internal/inventory/fefo/allocate` | FEFO plan (read-only) |
| Inventory `:5004` | `POST /internal/inventory/movements` | `SALE` / `RETURN_IN` (atomic guarded batch update + movement record) |
| Inventory `:5004` | `POST /internal/inventory/references` | batch display fields |

All of these endpoints already existed, so no Inventory endpoint was added in
Phase 7. `x-internal-token` is sent to Inventory when `INTERNAL_API_TOKEN` is set.
The Sales Service exposes no `/internal/*` routes.

## Sale creation

1. Validate the body (zod), then each medicine through the Medicine catalog.
2. Ask Inventory for a FEFO plan per line. This is read-only, and insufficient stock gives 409 before anything is written.
3. Generate the sale `_id` and invoice number, then apply one `SALE` movement per allocation.
   Movements carry `referenceType: SALE`, `referenceId: <saleId>` and reason `Sale <invoice>`.
4. Persist the `SaleItem`s, then the `Sale` with status `COMPLETED`.
5. Write the `CREATE_SALE` audit log (best effort) and return 201 with the populated sale.

A sale is only persisted after every stock movement succeeded.

## Cancellation

1. Atomically claim `COMPLETED → CANCELLED` (`findOneAndUpdate`). Only one request can win,
   so stock is never restored twice. Losers get 409 or 404.
2. Apply one `RETURN_IN` movement per sale item (reason `Cancel sale <invoice>`), with
   the exact batch and quantity of the original allocation.
3. Write the `CANCEL_SALE` audit log and return the sale.

## Compensation (no distributed transaction, no automatic retries)

| Failure | Behaviour |
| --- | --- |
| Medicine or FEFO call fails | Error returned. Nothing written anywhere |
| A `SALE` movement is rejected or unreachable | Already-applied lines get `RETURN_IN` (`Rollback failed sale <invoice>`). No sale is created |
| A `SALE` movement **times out** (outcome unknown) | Not retried and not compensated. A `RECONCILE` log names the sale id, batch and quantity. Earlier lines are compensated. 503 |
| Saving `SaleItem`/`Sale` fails after stock was consumed | Partial items deleted. All lines get `RETURN_IN`. Original error returned |
| A compensation call fails | `COMPENSATION FAILED ... Manual stock adjustment required` is logged per line |
| Cancel: first restore fails and was certainly not applied | Claim reverted to `COMPLETED`, so the cancel can be retried safely |
| Cancel: a restore fails after others succeeded, or times out | Sale stays `CANCELLED` (a retry cannot double-restore). A `PARTIAL CANCEL` log lists what is left |

"Certainly not applied" means the connection was refused or Inventory answered
with an error status. A timeout or a connection lost after sending is treated as
"unknown" and is never repeated. Every movement carries the sale id as
`referenceId`, so `stock_movements` can be filtered by it during reconciliation.

## Commands (PowerShell)

```powershell
Set-Location sales-service
npm install
npm run typecheck
npm test          # MongoMemoryServer + mock Auth/Medicine/Inventory; never touches the real DB
npm run dev       # needs MongoDB, Auth (:5002), Medicine (:5003), Inventory (:5004) and a .env
```

## Known limitations

- There is no idempotency key, the same as the monolith: a client that repeats a
  POST creates a second sale. Ambiguous Inventory timeouts are never retried by the service.
- Consistency across services relies on compensation, not a transaction. A crash
  between a stock movement and the sale insert leaves movements that reference a
  missing sale id; they are visible via `referenceId` and need manual reconciliation.
- `soldBy` is populated from the shared `users` collection, not through an Auth API.
- Run a single replica if you rely on the logs for reconciliation; the cancel claim
  itself is safe with multiple replicas.
