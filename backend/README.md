# PharmaStock Backend

Express + TypeScript API for the PharmaStock pharmacy inventory system.

## Setup

```bash
npm install
cp .env.example .env
```

Ensure MongoDB is running and `MONGODB_URI` points to database `pharmastock`.

Default URI:

```env
MONGODB_URI=mongodb://localhost:27017/pharmastock
```

If MongoDB is installed but `localhost` fails because of IPv6 (`::1`), use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/pharmastock
```

The API will not start until MongoDB accepts connections.

## Development

```bash
npm run dev
```

Server: `http://localhost:5000`

## Health check

```http
GET /api/health
```

```json
{
  "success": true,
  "message": "PharmaStock API is running",
  "database": "connected"
}
```

## REST API (Phase 3 + Phase 4)

Architecture:

```text
Route → Auth middleware (when protected) → Zod validation → Controller → Service → Mongoose model
```

### Authentication endpoints

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public (creates EMPLOYEE only) |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |

### Role access rules

| Area | Read (GET) | Write (POST/PUT/DELETE/PATCH) |
| --- | --- | --- |
| Health | Public | — |
| Auth register/login | Public | — |
| Categories / Suppliers / Medicines / Batches | ADMIN, PHARMACIST, EMPLOYEE | ADMIN, PHARMACIST |
| Stock overview / movements list | Authenticated | Movements + FEFO: ADMIN, PHARMACIST |
| Alerts snapshot | Authenticated | `POST /alerts/check`: ADMIN, PHARMACIST |
| Notifications | Own notifications | Mark own as read |
| Audit logs | ADMIN | — |

### Stock movement / FEFO (Phase 5)

```http
POST /api/stock/movements
Authorization: Bearer <token>
{
  "medicineId": "...",
  "batchId": "...",
  "type": "SALE",
  "quantity": 2,
  "reason": "Manual sale adjustment"
}

POST /api/stock/fefo/allocate
Authorization: Bearer <token>
{
  "medicineId": "...",
  "quantity": 10
}
```

FEFO allocate returns a plan only and does not mutate stock.

### Environment variables

```env
JWT_SECRET=change_me_to_a_long_random_secret
JWT_EXPIRES_IN=7d
EXPIRATION_WARNING_DAYS=30
STOCK_CHECK_INTERVAL_MS=3600000
STOCK_CHECK_ENABLED=true
```

## REST API (Phase 3)

Architecture:

```text
Route → Zod validation → Controller → Service → Mongoose model
```

Standard success response:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

List responses include pagination:

```json
{
  "success": true,
  "message": "Medicines retrieved successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

Error response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

### Inventory CRUD endpoints

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/categories` | pagination, search, sort |
| GET | `/api/categories/:id` | |
| POST | `/api/categories` | |
| PUT | `/api/categories/:id` | |
| DELETE | `/api/categories/:id` | soft delete (`isActive=false`) |
| GET | `/api/suppliers` | pagination, search, sort |
| GET | `/api/suppliers/:id` | |
| POST | `/api/suppliers` | |
| PUT | `/api/suppliers/:id` | |
| DELETE | `/api/suppliers/:id` | soft delete |
| GET | `/api/medicines` | `search`, `category`, `supplier`, sort |
| GET | `/api/medicines/barcode/:barcode` | exact barcode lookup (Phase 6) |
| GET | `/api/medicines/:id` | includes active batches |
| POST | `/api/medicines` | |
| PUT | `/api/medicines/:id` | |
| DELETE | `/api/medicines/:id` | soft delete |
| GET | `/api/batches` | filter by `medicine` |
| GET | `/api/batches/:id` | |
| POST | `/api/batches` | |
| PUT | `/api/batches/:id` | |
| DELETE | `/api/batches/:id` | soft delete |

Example:

```http
GET /api/medicines?page=1&limit=10&search=paracetamol
```

Validation uses Zod (`HTTP 422`). Duplicate keys return `409`. Missing resources return `404`.

### Stock movement / FEFO (Phase 5) — Postman examples

Authenticate first (`POST /api/auth/login`), then use `Authorization: Bearer <accessToken>`.
Do **not** send a JSON body on GET requests.

```http
POST /api/stock/movements
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "medicineId": "<medicineObjectId>",
  "batchId": "<batchObjectId>",
  "type": "SALE",
  "quantity": 2,
  "reason": "Manual sale adjustment"
}
```

```http
POST /api/stock/fefo/allocate
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "medicineId": "<medicineObjectId>",
  "quantity": 10
}
```

```http
GET /api/stock
Authorization: Bearer <accessToken>
```

```http
GET /api/stock/movements?page=1&limit=20
Authorization: Bearer <accessToken>
```

Movement write + FEFO allocate require **ADMIN** or **PHARMACIST**. FEFO returns a plan only and does not mutate stock.

### Smart Management (Phase 6)

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/alerts` | Authenticated — current expiration + low-stock snapshot |
| GET | `/api/alerts/expiration` | Authenticated |
| GET | `/api/alerts/low-stock` | Authenticated |
| POST | `/api/alerts/check` | ADMIN, PHARMACIST — run checks and create notifications |
| GET | `/api/notifications` | Authenticated — own notifications only |
| GET | `/api/notifications/unread-count` | Authenticated |
| PATCH | `/api/notifications/read-all` | Authenticated |
| GET | `/api/notifications/:id` | Authenticated — own only |
| PATCH | `/api/notifications/:id/read` | Authenticated — own only |
| GET | `/api/medicines/barcode/:barcode` | Authenticated |

```http
GET /api/alerts/expiration
Authorization: Bearer <accessToken>
```

```http
POST /api/alerts/check
Authorization: Bearer <accessToken>
```

```http
GET /api/notifications/unread-count
Authorization: Bearer <accessToken>
```

```http
PATCH /api/notifications/<notificationObjectId>/read
Authorization: Bearer <accessToken>
```

```http
GET /api/medicines/barcode/1234567890123
Authorization: Bearer <accessToken>
```

Future camera/USB scanners can call `GET /api/medicines/barcode/:barcode` with the scanned value (URL-encoded). No frontend scanner is included in Phase 6.

Alerts notify active **ADMIN** and **PHARMACIST** users. Duplicate unread notifications for the same medicine/batch condition are skipped. Low-stock unread alerts are marked read when stock returns to `>= minimumStock`.

Background scheduler (started once from `server.ts`):

- Disabled when `NODE_ENV=test` or `STOCK_CHECK_ENABLED=false`
- Interval: `STOCK_CHECK_INTERVAL_MS` (default 1 hour)
- Warning window: `EXPIRATION_WARNING_DAYS` (default 30)
- Overlap guarded with an in-process lock (no Redis)

## Database seed (development only)

```bash
npm run seed
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run seed` | Seed development database data |
| `npm run test:db` | Run database layer validation tests |
| `npm run test:auth` | Auth integration tests (requires MongoDB) |
| `npm run test:inventory` | Phase 5 inventory tests (memory Mongo) |
| `npm run test:smart` | Phase 6 smart-management tests (memory Mongo) |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Run ESLint |

## Notes

- Phases 1–6 backend: foundation, models, CRUD, auth, inventory logic, smart management
- Inventory/smart tests use `mongodb-memory-server` and do not touch your development database
- Standalone MongoDB does not support multi-document transactions; stock movements fall back to atomic updates + compensating rollback
- Do not commit real JWT secrets; use `.env` locally from `.env.example`
