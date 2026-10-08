# PharmaStock Purchase Service

Extracted from the former monolith in Phase 8. Owns purchases, purchase items and suppliers:
purchase creation, retrieval, receiving and cancellation, plus supplier CRUD. Port **5007**.

Stock and batches are never changed here. Every batch creation, stock increase and
batch deactivation is an Inventory Service internal call.

## Ownership

| Collection | Access |
| --- | --- |
| `purchases` | **owner** (all writes). Existing collection, documents and ids unchanged |
| `purchase_items` | **owner** (all writes). Existing collection, documents and ids unchanged |
| `suppliers` | **owner** (all writes). Existing collection, documents and ids unchanged |
| `users` | read-only populate of `purchasedBy` (`firstName lastName email [role]`). Owned by Auth Service |
| `audit_logs` | best-effort append of `CREATE_PURCHASE` (the only audited purchase action, as in the monolith). Owned by Auth Service |

Never accessed: `batches`, `stock_movements`, `medicines`, `notifications`.

Other readers of `suppliers`/`purchases` (read-only, unchanged):
- The Medicine Service reads `suppliers` (supplier existence check and populate on medicines).
- The Reporting Service reads `purchases`, `purchase_items` and `suppliers` read-only for the dashboard and reports.

## Public endpoints (via Gateway, unchanged contract)

All require `Authorization: Bearer <jwt>` (Auth Service introspection).

| Method | Path | Roles | Response |
| --- | --- | --- | --- |
| GET | `/api/purchases` (`page`, `limit`, `search`, `status`, `supplier`, `purchasedBy`, `sort`, `order`) | ADMIN, PHARMACIST | `Purchase[]` + `pagination` |
| POST | `/api/purchases` | ADMIN, PHARMACIST | 201 `Purchase` |
| GET | `/api/purchases/:id` | ADMIN, PHARMACIST | `Purchase` |
| POST | `/api/purchases/:id/receive` | ADMIN, PHARMACIST | `Purchase` |
| POST | `/api/purchases/:id/cancel` | ADMIN, PHARMACIST | `Purchase` |
| GET | `/api/suppliers` (`page`, `limit`, `search`, `isActive`, `sort`, `order`) | any authenticated | `Supplier[]` + `pagination` |
| GET | `/api/suppliers/:id` | any authenticated | `Supplier` |
| POST | `/api/suppliers` | ADMIN, PHARMACIST | 201 `Supplier` |
| PUT | `/api/suppliers/:id` | ADMIN, PHARMACIST | `Supplier` |
| DELETE | `/api/suppliers/:id` | ADMIN, PHARMACIST | `Supplier` (soft delete: `isActive: false`) |
| GET | `/api/health` | public | |

Validation, messages and status codes are the monolith's:
- 422 for invalid bodies or queries.
- 404 `Supplier not found` (missing or inactive on purchase creation), `Medicine not found` (missing or inactive), `Purchase not found`.
- 409 `Batch number X already exists for this medicine`, `Purchase is already received`,
  `Cancelled purchases cannot be received`, `Purchase is already cancelled`, `Received purchases cannot be cancelled`.

Populated fields match the monolith:
- **List view:** supplier `name phone email`; purchasedBy `firstName lastName email`; medicine `name barcode`; batch `batchNumber expirationDate quantity`.
- **Detail view:** supplier `+ address contactPerson`; purchasedBy `+ role`; medicine `+ unit`; batch `+ purchasePrice`.

A reference that no longer exists becomes `null`. If an owner service is down,
reads still succeed with `{ _id }` placeholders.

## Internal dependencies (Docker network only, never via Gateway)

| Service | Call | Use |
| --- | --- | --- |
| Auth `:5002` | `POST /internal/auth/introspect` | identity, role, isActive |
| Medicine `:5003` | `GET /internal/catalog/medicines/:id` | medicine validation (`isActive`) and display fields |
| Inventory `:5004` | `POST /internal/inventory/batches` | create the zero-quantity batch of a purchase line |
| Inventory `:5004` | `DELETE /internal/inventory/batches/:id` | compensation of a failed creation only |
| Inventory `:5004` | `POST /internal/inventory/batches/:id/deactivate-if-empty` | cancellation |
| Inventory `:5004` | `POST /internal/inventory/movements` | `PURCHASE` movement (atomic batch increase + movement record) |
| Inventory `:5004` | `POST /internal/inventory/references` | batch display fields |

The batch, movement and deactivation endpoints already existed (they served the
monolith's purchase flow). The only Inventory change in Phase 8 is an opt-in
`includePurchasePrice` flag on `/references` (default `false`, so other callers get
the same fields as before). `x-internal-token` is sent to Inventory when
`INTERNAL_API_TOKEN` is set. The Purchase Service exposes no `/internal/*` routes.

## Purchase creation

1. Validate the body (zod), then the supplier (local, must be active), then every medicine through the Medicine catalog. Nothing is written if any check fails.
2. Generate the purchase `_id` and number (`PUR-YYYYMMDD-NNNNN`).
3. For each line, create a zero-quantity batch in Inventory (duplicate batch number → 409).
   With `receiveNow: true`, also apply a `PURCHASE` movement (reason `Purchase <number>`,
   `referenceType: PURCHASE`, `referenceId: <purchaseId>`).
4. Persist the `PurchaseItem`s, then the `Purchase` (`PENDING`, or `RECEIVED` with `receiveNow`).
   `subtotal = Σ quantity × unitPrice`, `total = max(0, subtotal − discount + tax)`.
5. Write the `CREATE_PURCHASE` audit log (best effort) and return 201 with the populated purchase.

## Receiving and cancellation

- **Receive:** atomically claim `PENDING → RECEIVED`, so only one request can win and stock is never added twice.
  Then apply one `PURCHASE` movement per item (reason `Receive purchase <number>`).
- **Cancel:** atomically claim `PENDING → CANCELLED`, then ask Inventory to deactivate each
  line's batch only if it is still empty. No stock is touched.

Neither action is audited, the same as the monolith.

## Compensation (no distributed transaction, no automatic retries)

| Failure | Behaviour |
| --- | --- |
| Supplier or medicine validation fails | Error returned. Nothing written anywhere |
| A batch creation is rejected (409/404) or unreachable | Batches created for earlier lines are deleted. No purchase is created |
| A batch creation **times out** (outcome unknown) | Not retried. A `RECONCILE` log names the medicine and batch number. Earlier batches are deleted. 503. A client retry gets 409 (duplicate batch number), so nothing is duplicated |
| A `receiveNow` movement fails | All created batches (with their stock) are deleted. A `RECONCILE` log notes any movement left as history |
| Saving `PurchaseItem`/`Purchase` fails | Partial items deleted, created batches deleted, original error returned |
| A batch deletion fails | `COMPENSATION FAILED ... Manual cleanup required` is logged per batch |
| Receive: first line fails and was certainly not applied | Claim reverted to `PENDING`, so the receive can be retried safely |
| Receive: a line fails after others succeeded, or times out | Purchase stays `RECEIVED` (a retry cannot double-receive). A `PARTIAL RECEIVE` log lists what is left |
| Cancel: a deactivation fails | Purchase stays `CANCELLED` (no stock was involved). Every batch is attempted; a `PARTIAL CANCEL` log lists the ones left (deactivate-if-empty is safe to repeat). 503 |

"Certainly not applied" means the connection was refused or Inventory answered
with an error status. A timeout or a connection lost after sending is treated as
"unknown" and is never repeated. Every movement carries the purchase id as
`referenceId`, so `stock_movements` can be filtered by it during reconciliation.

## Commands (PowerShell)

```powershell
Set-Location purchase-service
npm install
npm run typecheck
npm test          # MongoMemoryServer + mock Auth/Medicine/Inventory; never touches the real DB
npm run dev       # needs MongoDB, Auth (:5002), Medicine (:5003), Inventory (:5004) and a .env
```

## Known limitations

- There is no idempotency key, the same as the monolith. Repeating a POST with new batch
  numbers creates a second purchase; repeating it with the same batch numbers gets 409.
- Consistency across services relies on compensation, not a transaction. A crash between
  batch creation and the purchase insert leaves empty (quantity 0) batches; with
  `receiveNow`, stocked batches whose movements reference a missing purchase id.
- `PUT /api/suppliers/:id` keeps the monolith quirk: the update schema is the create schema
  made partial, so omitted `phone`/`address`/`contactPerson` are reset to `''` and `isActive` to `true`.
- `purchasedBy` is populated from the shared `users` collection, not through an Auth API.
- Run a single replica if you rely on the logs for reconciliation; the receive/cancel
  claims themselves are safe with multiple replicas.
