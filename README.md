# 💊 PharmaStock

> A modern full-stack pharmacy inventory management system for managing
> medicines, stock, expiration dates, suppliers, sales, purchases,
> alerts, reports, and users.

------------------------------------------------------------------------

## 📌 About the Project

**PharmaStock** is a full-stack web application designed to help
pharmacies manage their inventory efficiently and reduce financial
losses caused by expired medicines, low stock levels, poor batch
tracking, and manual inventory management.

The platform centralizes pharmacy operations in one modern and
professional interface.

------------------------------------------------------------------------

## 🎯 Problem

Pharmacies may lose money because of:

-   Medicines reaching their expiration date without being detected
-   Low or unavailable stock
-   Poor batch management
-   Manual inventory tracking
-   Lack of real-time alerts
-   Difficulty monitoring sales and purchases
-   Lack of detailed inventory reports

## 💡 Solution

PharmaStock provides an intelligent inventory management system that:

-   Tracks medicine expiration dates
-   Detects low-stock medicines
-   Manages medicine batches
-   Uses **FEFO (First Expired, First Out)**
-   Automatically updates stock after sales and purchases
-   Provides expiration and stock alerts
-   Manages suppliers
-   Provides sales and purchase history
-   Generates statistics and reports
-   Supports role-based access control
-   Supports barcode-based medicine search
-   Tracks all stock movements

------------------------------------------------------------------------

# ✨ Main Features

## 📊 Dashboard

The dashboard provides a complete overview of the pharmacy:

-   Total medicines
-   Total stock
-   Low-stock medicines
-   Expired medicines
-   Medicines close to expiration
-   Today's sales
-   Today's purchases
-   Revenue overview
-   Profit overview
-   Sales statistics
-   Stock statistics
-   Recent transactions
-   Recent alerts

------------------------------------------------------------------------

## 💊 Medicine Management

Users can:

-   Add medicines
-   Edit medicines
-   Delete medicines
-   View medicine details
-   Search medicines
-   Filter medicines
-   Manage categories
-   Manage laboratories
-   Manage purchase prices
-   Manage selling prices
-   Define minimum stock levels
-   Manage expiration dates
-   Manage suppliers
-   Manage barcodes

Example medicine data:

``` text
Medicine
├── Name
├── Category
├── Laboratory
├── Barcode
├── Minimum Stock
├── Purchase Price
├── Selling Price
├── Supplier
└── Batches
```

------------------------------------------------------------------------

## 📦 Batch Management

Each medicine can have multiple batches.

Example:

``` text
Paracetamol

Batch A
Quantity: 100
Expiration: 2026-10-15

Batch B
Quantity: 200
Expiration: 2027-05-20
```

Each batch contains:

-   Batch number
-   Quantity
-   Purchase price
-   Expiration date
-   Creation date
-   Stock history

### FEFO

PharmaStock uses:

**First Expired, First Out**

The batch with the closest expiration date is prioritized first when
stock is sold.

This helps reduce losses caused by expired medicines.

------------------------------------------------------------------------

# 🚨 Smart Alerts

The system automatically detects important inventory conditions.

### 🔴 Expired Medicines

Detect medicines that have already expired.

``` text
🔴 EXPIRED

Amoxicillin
Expiration: 10/09/2026
```

### 🟠 Expiring Soon

Detect medicines that will expire within a configurable period.

``` text
🟠 EXPIRING SOON

Doliprane
Expires in 20 days
```

### ⚠️ Low Stock

Detect medicines whose quantity is below the configured minimum.

``` text
⚠️ LOW STOCK

Paracetamol
Current Stock: 5
Minimum Stock: 10
```

------------------------------------------------------------------------

# 🔔 Notifications

The application provides notifications for:

-   Expired medicines
-   Upcoming expiration dates
-   Low stock
-   Important stock movements
-   Purchase events
-   Other important inventory events

Notifications are accessible from the dashboard.

------------------------------------------------------------------------

# 📋 Stock Management

The system tracks every inventory operation.

Supported operations:

-   Stock entry
-   Stock exit
-   Sale
-   Purchase
-   Manual adjustment
-   Stock correction

Example:

``` text
Medicine: Paracetamol

+100  Purchase
-10   Sale
+20   Stock Adjustment
-------------------
110   Current Stock
```

Every movement can be associated with a user and a transaction.

------------------------------------------------------------------------

# 🧾 Sales Management

Users can:

-   Create a sale
-   Search medicines
-   Scan/search barcodes
-   Add medicines to cart
-   Change quantities
-   Calculate totals automatically
-   Validate sales
-   Automatically decrease stock
-   View sales history
-   View sale details

Example:

``` text
New Sale

Paracetamol × 2
Doliprane × 1

----------------
Subtotal: 17.40 DT
----------------
Total: 17.40 DT

[ Validate Sale ]
```

When a sale is validated:

``` text
Sale
 ↓
Check Stock
 ↓
Apply FEFO
 ↓
Decrease Stock
 ↓
Create Stock Movement
 ↓
Save Sale
```

------------------------------------------------------------------------

# 📥 Purchase Management

Manage purchases from suppliers.

Features:

-   Create purchases
-   Select suppliers
-   Add medicines
-   Select batches
-   Define quantities
-   Define purchase prices
-   Define expiration dates
-   Automatically increase stock
-   Create stock movements
-   View purchase history

Example:

``` text
Purchase

Supplier: PharmaTun

Paracetamol
Quantity: 100
Purchase Price: 3.20 DT
Expiration: 2027-05-20

Amoxicillin
Quantity: 50
Purchase Price: 8.00 DT
Expiration: 2027-01-15
```

------------------------------------------------------------------------

# 🚚 Supplier Management

Manage pharmacy suppliers.

Supplier information:

-   Name
-   Phone
-   Email
-   Address
-   Contact information
-   Purchase history

Users can:

-   Add suppliers
-   Edit suppliers
-   Delete suppliers
-   Search suppliers
-   View supplier details
-   View purchase history

------------------------------------------------------------------------

# 👥 User Management

PharmaStock includes role-based access control.

Available roles:

``` text
ADMIN
PHARMACIST
EMPLOYEE
```

Example permissions:

  Feature     Admin   Pharmacist   Employee
  ----------- ------- ------------ ----------
  Dashboard   ✅      ✅           ✅
  Medicines   ✅      ✅           ✅
  Stock       ✅      ✅           ✅
  Sales       ✅      ✅           ✅
  Purchases   ✅      ✅           ❌
  Suppliers   ✅      ✅           ❌
  Reports     ✅      ✅           ❌
  Users       ✅      ❌           ❌
  Settings    ✅      ❌           ❌

------------------------------------------------------------------------

# 📷 Barcode Scanner

PharmaStock can support barcode scanning for fast medicine
identification.

Workflow:

``` text
Scan Barcode
     ↓
Find Medicine
     ↓
Display Medicine
     ↓
Add to Sale
```

This reduces manual searching and makes the sales process faster.

------------------------------------------------------------------------

# 📊 Reports

The system provides reports for:

-   Sales
-   Purchases
-   Stock
-   Expired medicines
-   Expiring medicines
-   Low-stock medicines
-   Revenue
-   Profit
-   Stock movements

Reports can be exported to:

-   PDF
-   Excel

------------------------------------------------------------------------

# 📈 Dashboard Analytics

The dashboard can display charts such as:

-   Sales by day
-   Sales by month
-   Purchases by month
-   Stock by category
-   Top-selling medicines
-   Expiration statistics
-   Profit evolution

Charts are implemented using **Recharts**.

------------------------------------------------------------------------

# 🔐 Authentication & Security

The backend services implement:

-   JWT authentication (issued by the Auth Service; every other service validates tokens through Auth Service introspection)
-   Password hashing with bcrypt
-   Role-Based Access Control
-   Protected API routes
-   Input validation
-   CORS configuration
-   Helmet
-   Rate limiting
-   Environment variables
-   Secure authentication middleware

Authentication flow:

``` text
Login
  ↓
Validate Credentials
  ↓
Generate JWT
  ↓
Frontend Authentication
  ↓
Protected API Requests
```

------------------------------------------------------------------------

# 🏗️ Architecture

``` text
Browser
 ↓
Frontend (React SPA, Nginx :8080)
 ↓  /api/*
API Gateway :5000  (the only public backend entry point)
 ├─ Auth :5002
 ├─ Medicine :5003
 ├─ Inventory :5004
 ├─ Notification :5005
 ├─ Sales :5006
 ├─ Purchase :5007
 └─ Reporting :5008 (read-only)
       ↓
   MongoDB (shared database "pharmastock")
```

Each service is an Express.js + Mongoose application with its own Dockerfile, tests and
README. The services still share one MongoDB database (`pharmastock`); this is **not**
database-per-service isolation. Collection ownership (which service writes what):

| Service | Owns (writes) |
| --- | --- |
| Auth | `users`, `audit_logs` (other services append their own audit entries, as implemented) |
| Medicine | `medicines`, `categories` |
| Inventory | `batches`, `stock_movements` (stock levels, FEFO) |
| Notification | `notifications` (alert check and scheduler) |
| Sales | `sales`, `sale_items` |
| Purchase | `purchases`, `purchase_items`, `suppliers` |
| Reporting | nothing: read-only access for the dashboard, reports and CSV exports |

Services call each other only through private `/internal/*` endpoints on the Docker network;
the Gateway never exposes them. See [`docker/README.md`](docker/README.md) and
[`gateway/README.md`](gateway/README.md) for the routing matrix.

------------------------------------------------------------------------

# 🛠️ Technology Stack

## Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   shadcn/ui
-   React Router
-   Axios
-   React Hook Form
-   Zod
-   Recharts
-   Lucide React

## Backend (microservices)

-   Node.js
-   Express.js
-   MongoDB
-   Mongoose
-   JWT
-   bcrypt
-   http-proxy-middleware (API Gateway)

## DevOps

-   Docker
-   Docker Compose
-   Nginx
-   Git
-   GitHub
-   GitHub Actions / Jenkins

## Monitoring

-   Prometheus
-   Grafana

------------------------------------------------------------------------

# 🎨 UI / UX

The application is designed to be:

-   Modern
-   Clean
-   Professional
-   Responsive
-   Easy to use
-   Desktop-friendly
-   Tablet-friendly
-   Accessible

The UI is based on:

``` text
Tailwind CSS
      +
shadcn/ui
      +
Lucide Icons
      +
Recharts
```

------------------------------------------------------------------------

# 📁 Project Structure

``` text
pharmastock/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── gateway/                 # API Gateway :5000 (routing only)
├── auth-service/            # :5002
├── medicine-service/        # :5003
├── inventory-service/       # :5004
├── notification-service/    # :5005
├── sales-service/           # :5006
├── purchase-service/        # :5007
├── reporting-service/       # :5008 (read-only)
│   ├── src/                 # each service: config, controllers, middleware,
│   │                        # models, routes, schemas, services, utils
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
│
├── tools/
│   └── dev-seed/            # development seed (npm run seed)
│
├── docker/
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

# 🗄️ Database Architecture

PharmaStock uses **MongoDB** with **Mongoose** as the ODM.

Database name: `pharmastock`

Connection module: `src/config/database.ts` in each service. All services connect to the same
`pharmastock` database (shared database; see the ownership table in [Architecture](#️-architecture)).

Each service connects to MongoDB during startup and refuses to start if the database is unavailable.

## Main collections

``` text
User
Medicine
Category
Supplier
Batch
Sale
SaleItem
Purchase
PurchaseItem
StockMovement
Notification
AuditLog
```

## Relationships

``` text
User
 │
 ├── Sales (soldBy)
 ├── Purchases (purchasedBy)
 ├── Notifications
 ├── StockMovements (performedBy)
 └── AuditLogs

Category ──< Medicine >── Supplier

Medicine
 │
 ├── Batches
 ├── SaleItems
 ├── PurchaseItems
 ├── StockMovements
 └── Notifications (relatedMedicine)

Sale ──< SaleItem >── Batch
Purchase ──< PurchaseItem >── Batch
```

## FEFO preparation

Batches are stored in a dedicated collection with:

- `medicine` reference
- `batchNumber` (unique per medicine)
- `quantity`
- `expirationDate`

This structure prepares Phase 4+ FEFO (First Expired, First Out) without embedding stock lots inside Medicine documents.

## Stock movement architecture

Every inventory change will eventually write a `StockMovement` record:

- movement type (`PURCHASE`, `SALE`, adjustments, returns)
- medicine + batch references
- previous/new quantities
- optional sale/purchase reference
- performing user

This supports inventory history and auditing independently from transaction documents.

## Sale / Purchase line items

`SaleItem` and `PurchaseItem` are **separate collections**, referenced from their parent documents via `items: ObjectId[]`.

This balances:

- consistency for transaction headers and totals
- efficient medicine/batch reporting queries
- maintainable line-item history for FEFO and stock audits

## Development seed

``` powershell
npm install --prefix tools/dev-seed
npm run seed          # from the repository root (MONGODB_URI defaults to mongodb://localhost:27017/pharmastock)
```

Seeds only run when explicitly requested. Production seeding is blocked unless `ALLOW_SEED=true`.
The seed replaces its own sample records (the seed admin, 3 categories, 3 suppliers, 3 medicines, 3 batches) and leaves all other data untouched.

The seed creates `admin@pharmastock.local` (role `ADMIN`). The development password is defined in `tools/dev-seed/src/seed.ts` and is printed once by the seed script to the console (it is stored hashed in MongoDB). Do not use seed credentials in production.

If login fails for that email, confirm the user exists in the `pharmastock` database and that the Auth Service is connected to the same MongoDB instance.

------------------------------------------------------------------------

# 🔌 REST API

## Authentication

``` http
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

## Medicines

``` http
GET    /api/medicines
GET    /api/medicines/:id
POST   /api/medicines
PUT    /api/medicines/:id
DELETE /api/medicines/:id
```

## Categories

``` http
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
```

## Batches

``` http
GET  /api/medicines/:id/batches
POST /api/medicines/:id/batches
PUT  /api/batches/:id
```

## Stock

``` http
GET  /api/stock
POST /api/stock/in
POST /api/stock/out
GET  /api/stock/movements
```

## Sales

``` http
GET  /api/sales
GET  /api/sales/:id
POST /api/sales
```

## Purchases

``` http
GET  /api/purchases
GET  /api/purchases/:id
POST /api/purchases
```

## Suppliers

``` http
GET    /api/suppliers
POST   /api/suppliers
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id
```

## Alerts

``` http
GET /api/alerts
GET /api/alerts/expiration
GET /api/alerts/low-stock
```

## Reports

``` http
GET /api/reports/sales
GET /api/reports/purchases
GET /api/reports/stock
GET /api/reports/expiration
GET /api/reports/profit
```

------------------------------------------------------------------------

# ⚙️ Environment Variables

Each service has its own `.env.example` (`auth-service/`, `medicine-service/`, `inventory-service/`,
`notification-service/`, `sales-service/`, `purchase-service/`, `reporting-service/`, `gateway/`).
Copy each to `.env` for local development. The shared values are:

``` env
MONGODB_URI=mongodb://127.0.0.1:27017/pharmastock   # same database for every service
JWT_SECRET=your_own_long_random_secret_at_least_32_chars   # same secret for every service
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
AUTH_SERVICE_URL=http://127.0.0.1:5002   # every service except Auth
NODE_ENV=development
```

Service-specific values (for example `MEDICINE_SERVICE_URL`, `INVENTORY_SERVICE_URL`,
`INTERNAL_API_TOKEN`, `STOCK_CHECK_*`, `EXPIRATION_WARNING_DAYS`, the Gateway's `*_URL` targets)
are documented in each `.env.example` and README.

Create a `.env` file in the frontend from `frontend/.env.example`:

``` env
VITE_API_URL=http://localhost:5000/api
```

For Docker Compose, also create a **root** `.env` from `.env.example`:

``` env
JWT_SECRET=your_own_long_random_secret_at_least_32_chars
CLIENT_URL=http://localhost:8080
ALLOW_PUBLIC_REGISTER=true
```

Do not commit real secrets. `.env` files are gitignored. Production builds reject short or documented placeholder `JWT_SECRET` values.

------------------------------------------------------------------------

# ▶️ Run the Application (local development)

Local development uses Vite (port 5173), the API Gateway (port 5000) and the seven services
(ports 5002–5008) with a MongoDB instance on the host (`localhost` / `127.0.0.1`).

## Start everything (frontend, Gateway and all services)

``` powershell
npm run install:all
Copy-Item frontend/.env.example frontend/.env
# Copy <service>/.env.example to <service>/.env for gateway and each *-service
npm run dev
```

## Start a single service

``` powershell
npm run dev:gateway        # :5000
npm run dev:auth           # :5002
npm run dev:medicine       # :5003
npm run dev:inventory      # :5004
npm run dev:notification   # :5005
npm run dev:sales          # :5006
npm run dev:purchase       # :5007
npm run dev:reporting      # :5008
```

Public API: `http://localhost:5000/api` — health: `GET /api/health` (answered by the Gateway)

## Start Frontend only

``` bash
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`

------------------------------------------------------------------------

# 🐳 Docker Compose (production-style stack)

Runs **10 containers** on an internal Docker network: frontend (Nginx), API Gateway,
Auth, Medicine, Inventory, Notification, Sales, Purchase, Reporting and MongoDB.

| Container | Host access | Notes |
| --- | --- | --- |
| Frontend | `http://localhost:8080` | Nginx serves the SPA and proxies `/api` → Gateway |
| Gateway | `http://localhost:5000` | Only public backend entry point; `GET /gateway/health` shows every service |
| Auth … Reporting | `127.0.0.1:5002` … `127.0.0.1:5008` | Debug only (loopback); not public |
| MongoDB | `127.0.0.1:27017` | Host-only publish for local `npm run dev`; data in `mongo_data` volume |

``` powershell
Copy-Item .env.example .env
# Edit JWT_SECRET to a unique 32+ character value (placeholders are rejected)

docker compose up --build -d
docker compose ps
```

Stop (keeps the Mongo volume):

``` powershell
docker compose down
```

Data persists in the `mongo_data` volume. **Never** run `docker compose down -v`: it deletes the database volume.
See [`docker/README.md`](docker/README.md) for the full container map and private service calls.

### Local vs Docker configuration

| Setting | Local (`npm run dev`) | Docker Compose |
| --- | --- | --- |
| Frontend API URL | `VITE_API_URL=http://localhost:5000/api` | Build arg `/api` (Nginx proxy) |
| MongoDB URI | `mongodb://localhost:27017/pharmastock` | `mongodb://mongo:27017/pharmastock` |
| CLIENT_URL | `http://localhost:5173` | `http://localhost:8080` |
| Frontend port | 5173 (Vite) | 8080 → container 80 |
| Public register | Default true (non-production) | Default true via Compose env |

### Manual steps still required

- Provide a strong unique `JWT_SECRET` in root `.env` before Compose (documented placeholders are rejected when `NODE_ENV=production`).
- Optional demo data: create the first account via the register UI (Compose defaults `ALLOW_PUBLIC_REGISTER=true`), then promote roles in MongoDB if needed. Production images do not include the seed script; run `npm run seed` from a development checkout only against a non-production database, with `ALLOW_SEED=true` if `NODE_ENV=production`.
- TLS/HTTPS and image publishing are **not** automated.
- Prometheus/Grafana are deferred.

------------------------------------------------------------------------

# ☁️ Cloud deployment readiness (manual)

PharmaStock is **not** auto-deployed. Use these targets when you are ready; do not treat this as a completed deployment.

## MongoDB Atlas

1. Create a free/shared cluster and database user.
2. Allow network access from your service hosts (or `0.0.0.0/0` only while testing).
3. Copy the SRV connection string into every service's `MONGODB_URI` (one shared database).
4. Prefer a dedicated DB name (e.g. `pharmastock`).

## Backend services

The backend is now eight deployables (Gateway + seven services). Each has a Dockerfile and
`npm ci && npm run build` / `npm start`. For each service:

1. Set `NODE_ENV=production`, `PORT`, `MONGODB_URI`, the same unique `JWT_SECRET` (≥32 chars, not a README placeholder), `CLIENT_URL` to your frontend URL (https), and `AUTH_SERVICE_URL` (all except Auth). On Auth, usually `ALLOW_PUBLIC_REGISTER=false`.
2. Set the private service URLs (`MEDICINE_SERVICE_URL`, `INVENTORY_SERVICE_URL`) and, ideally, `INTERNAL_API_TOKEN`; keep `/internal/*` off the public internet.
3. Expose only the Gateway publicly, with its `*_URL` targets pointing to the services. Health check path: `/gateway/health` (Gateway) or `/api/health` (each service).
4. Confirm CORS matches the frontend origin exactly.

## Frontend on Vercel

1. New project; root directory `frontend`.
2. Framework: Vite. Build: `npm run build` — Output: `dist`.
3. Set `VITE_API_URL` to the public Gateway API base, e.g. `https://your-gateway.example.com/api` (no trailing path beyond `/api`).
4. SPA routing: ensure all routes rewrite to `/index.html` (Vercel Vite preset usually handles this).
5. Redeploy after changing `VITE_API_URL` (it is baked in at build time).

## Checklist before go-live

- [ ] Strong unique `JWT_SECRET`
- [ ] `ALLOW_PUBLIC_REGISTER=false` (or admin-only registration)
- [ ] `ALLOW_SEED` not enabled
- [ ] Atlas network rules tightened
- [ ] CORS `CLIENT_URL` matches the real frontend origin
- [ ] Change or remove any seed admin password if seed was used
- [ ] Inventory CRUD UI is still incomplete — plan ops accordingly

------------------------------------------------------------------------

# 🧪 Tests and builds

In each service directory (`gateway`, `auth-service`, `medicine-service`, `inventory-service`,
`notification-service`, `sales-service`, `purchase-service`, `reporting-service`):

``` powershell
npm run typecheck
npm test          # MongoMemoryServer and mock upstreams; never touches the real database
npm run build
```

Frontend (`frontend/`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Dev seed (`tools/dev-seed/`): `npm run typecheck`, `npm test`.

From the repository root:

``` powershell
npm run typecheck
npm run lint
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs the frontend checks, typecheck/test/build for the Gateway and every service, the dev-seed tests, and `docker compose config` validation. It does **not** deploy.

------------------------------------------------------------------------

# 📦 Docker images (manual)

``` bash
docker compose build    # gateway, the seven services and the frontend
docker build -t pharmastock-frontend ./frontend --build-arg VITE_API_URL=/api
docker compose config
```

------------------------------------------------------------------------

# 📈 Monitoring (future)

Prometheus metrics and Grafana dashboards are planned but not included in Phase 9.

Monitoring architecture:

``` text
Application
     │
     ▼
 Prometheus
     │
     ▼
 Grafana
```

Possible metrics:

-   HTTP requests
-   Response time
-   Error rate
-   CPU usage
-   Memory usage
-   Database operations
-   Application uptime

------------------------------------------------------------------------

# 🔄 CI/CD

The repository includes a **verify-only** GitHub Actions workflow (`.github/workflows/ci.yml`):

- Install dependencies
- Frontend lint / typecheck / tests / build
- Gateway and per-service typecheck, memory-mongo test suites and builds
- Dev-seed tests
- `docker compose config` validation

It does **not** push images or deploy. Image publishing and cloud deployment remain future work.

------------------------------------------------------------------------

# 🐳 Production Architecture

``` text
                    Internet
                       │
                       ▼
              Nginx (React frontend)
                       │  /api/*
                       ▼
                 API Gateway :5000
                       │
   ┌──────┬──────────┬─┴────────┬─────────────┬───────┬──────────┬───────────┐
   ▼      ▼          ▼          ▼             ▼       ▼          ▼
  Auth  Medicine  Inventory  Notification   Sales  Purchase  Reporting
   └──────┴──────────┴──────────┴─────────────┴───────┴──────────┘
                       │
                       ▼
             MongoDB (shared "pharmastock")
                       │
              ┌────────┴────────┐
              ▼                 ▼
         Prometheus          Backup
          (future)          (future)
```

------------------------------------------------------------------------

# 🗺️ Development Roadmap

## Phase 1 --- Project Setup

-   [x] Create React + Vite project
-   [x] Create Express API
-   [x] Configure MongoDB connection module
-   [x] Configure Tailwind CSS
-   [x] Configure shadcn/ui
-   [x] Configure Git
-   [x] Create project structure

## Phase 2 --- Database & MongoDB Architecture

-   [x] MongoDB connection on startup
-   [x] Mongoose models (User, Medicine, Category, Supplier, Batch, Sale, SaleItem, Purchase, PurchaseItem, StockMovement, Notification, AuditLog)
-   [x] Indexes and validation
-   [x] Optional development seed
-   [x] Database health status
-   [x] Database layer tests

## Phase 3 --- REST API

-   [x] API response helpers and centralized error handling
-   [x] Zod request validation middleware
-   [x] Categories CRUD
-   [x] Suppliers CRUD
-   [x] Medicines CRUD
-   [x] Batches CRUD
-   [ ] Authentication (JWT) — later phase
-   [ ] Sale/purchase creation and stock mutations — later phase

## Phase 4 --- Authentication

-   [x] Register
-   [x] Login
-   [x] JWT
-   [x] Password hashing
-   [x] Roles
-   [x] Protected routes
-   [x] Authorization middleware

## Phase 5 --- Inventory logic

-   [x] Stock movements automation
-   [x] FEFO logic

## Phase 6 --- Smart Management

-   [x] Expiration alerts
-   [x] Low-stock alerts
-   [x] Notifications
-   [x] Barcode scanner
-   [x] Automatic stock checks

## Phase 7 --- Transactions

-   [x] Sales
-   [x] Purchases
-   [x] Automatic stock updates
-   [x] Sales history
-   [x] Purchase history
-   [x] Transaction details

## Phase 8 --- Dashboard & Reports

-   [x] Dashboard
-   [x] Statistics
-   [x] Charts
-   [x] Sales reports
-   [x] Stock reports
-   [x] Expiration reports
-   [x] Profit reports
-   [x] PDF export
-   [x] Excel export

## Phase 9 --- DevOps

-   [x] Docker
-   [x] Docker Compose
-   [x] Nginx
-   [x] CI (GitHub Actions verify-only)
-   [ ] Docker image publishing
-   [ ] Prometheus
-   [ ] Grafana
-   [ ] Production deployment

## Microservices migration (strangler fig, complete)

-   [x] API Gateway as the single public entry point
-   [x] Auth Service (users, JWT, introspection, audit logs)
-   [x] Medicine Service (medicines, categories, barcode)
-   [x] Inventory Service (batches, stock, movements, FEFO, alert snapshots)
-   [x] Notification Service (notifications, alert check, scheduler)
-   [x] Sales Service
-   [x] Purchase Service (purchases, suppliers)
-   [x] Reporting Service (read-only dashboard, reports, CSV)
-   [x] Monolith decommissioned (removed from the runtime and the repository)
-   [ ] Database-per-service (the services still share the `pharmastock` database)

------------------------------------------------------------------------

# 🚀 Future Improvements

Possible future features:

-   🤖 AI-based stock prediction
-   📈 Demand forecasting
-   🛒 Automatic reorder suggestions
-   📧 Email notifications
-   📱 SMS notifications
-   🧾 Invoice generation
-   📷 Advanced barcode/QR scanning
-   ☁️ Cloud deployment
-   💾 Automatic database backups
-   📱 Mobile application
-   🌍 Multi-pharmacy support
-   📊 Advanced business analytics

------------------------------------------------------------------------

# 👨‍💻 Author

**Marwan Barhoumi**

Full Stack Developer \| DevOps & Cloud

------------------------------------------------------------------------

# 📄 License

This project is developed for educational and professional portfolio
purposes.
