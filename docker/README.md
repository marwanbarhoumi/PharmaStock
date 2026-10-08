# Docker notes

Final architecture (10 containers):

```text
Browser
   ↓
Frontend (Nginx) :8080
   ↓  /api/*
Gateway :5000  (only public backend entry point)
   ├── Auth :5002
   ├── Medicine :5003
   ├── Inventory :5004
   ├── Notification :5005
   ├── Sales :5006
   ├── Purchase :5007
   └── Reporting :5008 (read-only)
            ↓
       MongoDB :27017 (shared database "pharmastock")
```

- Compose file: [`../docker-compose.yml`](../docker-compose.yml)
- API Gateway: [`../gateway`](../gateway) — public entry on `:5000` (routing matrix in its README)
  - `/api/auth/*`, `/api/audit-logs` → Auth Service
  - `/api/medicines/*`, `/api/categories/*` → Medicine Service
  - `/api/batches/*`, `/api/stock/*`, `/api/alerts/*` (except `/api/alerts/check`) → Inventory Service
  - `/api/notifications/*`, `/api/alerts/check` → Notification Service
  - `/api/sales/*` → Sales Service
  - `/api/purchases/*`, `/api/suppliers/*` → Purchase Service
  - `/api/dashboard/*`, `/api/reports/*` → Reporting Service (read-only)
  - `/api/health` → answered by the Gateway; any other `/api/*` → 404
  - `/internal/*` → never proxied (404)
- Auth Service: [`../auth-service`](../auth-service)
- Medicine Service: [`../medicine-service`](../medicine-service)
- Inventory Service: [`../inventory-service`](../inventory-service)
- Notification Service: [`../notification-service`](../notification-service)
- Sales Service: [`../sales-service`](../sales-service)
- Purchase Service: [`../purchase-service`](../purchase-service)
- Reporting Service: [`../reporting-service`](../reporting-service)

All services share the `pharmastock` database on the `mongo_data` volume
(shared database, not database-per-service). Private service-to-service calls on the Compose network:

- Sales → `http://inventory:5004/internal/inventory/fefo/allocate`, `/movements`, `/references`
- Sales → `http://medicine:5003/internal/catalog/medicines/:id`
- Purchase → `http://inventory:5004/internal/inventory/batches`, `/batches/:id` (DELETE, compensation),
  `/batches/:id/deactivate-if-empty`, `/movements`, `/references`
- Purchase → `http://medicine:5003/internal/catalog/medicines/:id`
- Inventory → `http://medicine:5003/internal/catalog/medicines/:id`
- Notification → `http://inventory:5004/internal/inventory/alerts` and `/references`
- Every service → `http://auth:5002/internal/auth/introspect`

The alert-check scheduler runs **only** in the Notification Service. The root `.env`
`STOCK_CHECK_*` values configure it; `EXPIRATION_WARNING_DAYS` is passed to
Notification, Inventory and Reporting.

## Quick start

```powershell
Copy-Item ..\.env.example ..\.env
# Set a unique JWT_SECRET (32+ characters); optionally set INTERNAL_API_TOKEN

Set-Location ..
docker compose up --build -d
docker compose ps    # 10 containers, all healthy
```

- App (Nginx): http://localhost:8080
- **Public API (Gateway):** http://localhost:5000/api/health
- Gateway liveness + service status: http://localhost:5000/gateway/health
- Auth debug: http://127.0.0.1:5002/api/health
- Medicine debug: http://127.0.0.1:5003/api/health
- Inventory debug: http://127.0.0.1:5004/api/health
- Notification debug: http://127.0.0.1:5005/api/health
- Sales debug: http://127.0.0.1:5006/api/health
- Purchase debug: http://127.0.0.1:5007/api/health
- Reporting debug: http://127.0.0.1:5008/api/health

Debug ports are bound to `127.0.0.1` only. They also expose the `/internal/*`
routes to the host, so keep them loopback-only (or set `INTERNAL_API_TOKEN`).

Startup order: mongo → auth → medicine / reporting → inventory → notification / sales / purchase → gateway → frontend.

If you upgrade an existing stack that still has the old `pharmastock-backend` container,
run `docker compose up --build -d --remove-orphans` once to remove it (containers only; volumes are kept).

Stop without deleting data: `docker compose down`  
Do **not** run `docker compose down -v`.
