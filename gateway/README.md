# PharmaStock API Gateway

Single public backend entry point for the PharmaStock API (port **5000**).
The frontend only talks to the Gateway (`VITE_API_URL=http://localhost:5000/api`, or `/api` through Nginx).

## Routing matrix

| Public path | Destination |
| --- | --- |
| `/api/auth/*`, `/api/audit-logs/*` | Auth Service (`AUTH_URL`) |
| `/api/medicines/*`, `/api/categories/*` | Medicine Service (`MEDICINE_URL`) |
| `/api/batches/*`, `/api/stock/*`, `/api/alerts/*` (except `/api/alerts/check`) | Inventory Service (`INVENTORY_URL`) |
| `/api/notifications/*`, `/api/alerts/check` | Notification Service (`NOTIFICATION_URL`) |
| `/api/sales/*` | Sales Service (`SALES_URL`) |
| `/api/purchases/*`, `/api/suppliers/*` | Purchase Service (`PURCHASE_URL`) |
| `/api/dashboard/*`, `/api/reports/*` | Reporting Service (`REPORTING_URL`, read-only) |
| `GET /api/health` | answered by the Gateway: `{ success, message: 'PharmaStock API is running', database }`, where `database` is `connected` only when every service reports a connected database |
| any other `/api/*` | 404 `{ success: false, message: 'Route not found', errors: [] }` |
| `/internal/*` | never proxied, always 404 (service-to-service only) |
| `GET /gateway/health` | Gateway liveness (always 200) with `services: { auth, medicine, inventory, notification, sales, purchase, reporting }` reporting `up`/`down` from each service's `/api/health` (2 s timeout) |

Prefix matching is segment-based: a prefix matches itself and `prefix/...` only, so
`/api/medicinesx`, `/api/stockpile`, `/api/salesx`, `/api/purchasesx`, `/api/dashboardx`,
`/api/reportsx` and similar look-alikes are never sent to a service (they get the 404 above).

No authentication logic, no domain services, and no MongoDB access in this package.
Authentication and RBAC are enforced by each service (via Auth Service introspection).

## Environment

| Variable | Default |
| --- | --- |
| `PORT` | `5000` |
| `AUTH_URL` | `http://127.0.0.1:5002` |
| `MEDICINE_URL` | `http://127.0.0.1:5003` |
| `INVENTORY_URL` | `http://127.0.0.1:5004` |
| `NOTIFICATION_URL` | `http://127.0.0.1:5005` |
| `SALES_URL` | `http://127.0.0.1:5006` |
| `PURCHASE_URL` | `http://127.0.0.1:5007` |
| `REPORTING_URL` | `http://127.0.0.1:5008` |

## Commands (PowerShell)

```powershell
Set-Location gateway
npm install
npm run typecheck
npm test     # mock upstream services; checks routing, look-alikes, /internal isolation and health
npm run dev
```
