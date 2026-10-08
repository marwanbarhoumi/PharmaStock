# PharmaStock Reporting Service

Extracted from the former monolith in Phase 9. Serves the dashboard, the reports and the CSV
exports. Port **5008**. **Read-only**: it never writes to MongoDB.

The services, controllers, routes, schemas and CSV/date/pagination utilities are
copied verbatim from the former monolith, so JSON shapes, messages, status codes, filters,
pagination, date handling and CSV output are identical.

## Data sources (all read-only)

The reports aggregate across domains (for example `$lookup` from `sale_items` into
`batches` for profit), so the service reads the shared `pharmastock` database directly
instead of fanning out to every owner service.

| Collection | Owner | Used for |
| --- | --- | --- |
| `sales`, `sale_items` | Sales Service | summary, charts, recent, sales/profit reports and CSVs |
| `purchases`, `purchase_items`, `suppliers` | Purchase Service | summary, purchases report and CSV |
| `medicines`, `categories` | Medicine Service | stock, low-stock, expiration reports; populates |
| `batches`, `stock_movements` | Inventory Service | stock values, expiration, profit cost, recent movements |
| `users` | Auth Service | populate of `soldBy`, `purchasedBy`, `performedBy` (names only) |

Never accessed: `notifications`, `audit_logs`.

## Read-only guarantee

- A global mongoose plugin (`src/models/read-only.ts`, registered before any model compiles) makes
  `save`, `insertMany`, `bulkWrite`, `updateOne/Many`, `replaceOne`, `deleteOne/Many` and
  `findOneAnd{Update,Delete,Replace}` throw `ReadOnlyViolationError`.
- The connection uses `autoIndex: false` and `autoCreate: false`, so no collections or indexes are created.
- There is no write code path: only `find`, `countDocuments` and `aggregate` (without `$out`/`$merge`).
- Tests fingerprint every collection and the index list before and after all endpoints run, and assert they are identical.

## Endpoints (via Gateway, unchanged contract)

All require `Authorization: Bearer <jwt>` (Auth Service introspection: `POST /internal/auth/introspect`).
Missing, invalid or inactive-user tokens get 401.

| Method | Path | Roles | Query |
| --- | --- | --- | --- |
| GET | `/api/dashboard/summary` | any authenticated | `from`, `to` (YYYY-MM-DD) |
| GET | `/api/dashboard/charts` | any authenticated | `from`, `to` |
| GET | `/api/dashboard/recent` | any authenticated | none (8 latest completed sales and movements) |
| GET | `/api/reports/sales` | ADMIN, PHARMACIST | `page`, `limit` (1..100), `from`, `to`, `search` |
| GET | `/api/reports/purchases` | ADMIN, PHARMACIST | same |
| GET | `/api/reports/stock` | ADMIN, PHARMACIST | same |
| GET | `/api/reports/low-stock` | ADMIN, PHARMACIST | same |
| GET | `/api/reports/expiration` | ADMIN, PHARMACIST | same + `warningDays` (1..365) |
| GET | `/api/reports/profit` | ADMIN, PHARMACIST | same |
| GET | `/api/reports/export` | ADMIN, PHARMACIST | `type` (`sales`, `purchases`, `stock`, `low-stock`, `expiration`, `profit`), `format=csv`, `from`, `to`, `search` |
| GET | `/api/health` | public | |

Behaviour kept from the monolith:
- Date ranges default to the last 30 days (UTC). `from > to` gives 400 `from must be before or equal to to`.
- Invalid queries give 422 `Validation failed`. EMPLOYEE gets 403 on every `/api/reports/*` route.
- CSV: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<type>-report-YYYY-MM-DD.csv"`,
  same headers, column order, escaping and trailing newline, 5000 rows maximum.
- Profit uses `batch.purchasePrice` at reporting time for each sold line.

If MongoDB is unreachable the service answers **503** `Reporting data source unavailable`
and never returns an empty or partial report.

## Gateway routing

`/api/dashboard` and `/api/reports` (exact segment, so `/api/dashboardx` and `/api/reportsx` are
not matched) go to `REPORTING_URL`. The Reporting Service exposes no `/internal/*` routes.

## Environment

See `.env.example`: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`,
`CORS_ORIGINS`, `AUTH_SERVICE_URL` (required in production), `EXPIRATION_WARNING_DAYS`, `NODE_ENV`.

## Commands (PowerShell)

```powershell
Set-Location reporting-service
npm install
npm run typecheck
npm test          # MongoMemoryServer + mock Auth; exact values, CSV bytes, RBAC, zero writes, 503
npm run build
npm run dev       # needs MongoDB, Auth (:5002) and a .env
```

Docker: the `reporting` service in `docker-compose.yml` (container `pharmastock-reporting`,
debug port `127.0.0.1:5008`). It starts after `mongo` and `auth` are healthy.

## Known limitations

- Reads the shared database directly (no owner APIs), so it depends on the other services' collection schemas.
  A schema change in an owner service must be reflected here.
- Reports are computed on every request (no cache or read model), like the monolith.
- `users` are read for display names only; Auth still owns them.
- The `/api` rate limiter (200 requests per 15 minutes per client IP) is the same as the other
  services'. Behind the Gateway every client shares the Gateway's IP.
