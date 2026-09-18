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

The backend implements:

-   JWT authentication
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
                    ┌──────────────────────┐
                    │        React         │
                    │      Frontend        │
                    └──────────┬───────────┘
                               │
                             Axios
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Express.js      │
                    │       REST API       │
                    └──────────┬───────────┘
                               │
                           Mongoose
                               │
                               ▼
                    ┌──────────────────────┐
                    │       MongoDB        │
                    │       Database       │
                    └──────────────────────┘
```

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

## Backend

-   Node.js
-   Express.js
-   MongoDB
-   Mongoose
-   JWT
-   bcrypt
-   Multer

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
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── config/
│   │   └── utils/
│   │
│   ├── uploads/
│   └── package.json
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

Connection module: `backend/src/config/database.ts`

The API connects to MongoDB during startup and refuses to start if the database is unavailable.

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

``` bash
cd backend
npm run seed
```

Seeds only run when explicitly requested. Production seeding is blocked unless `ALLOW_SEED=true`.

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

Create a `.env` file in the backend from `backend/.env.example`:

``` env
PORT=5000

MONGODB_URI=mongodb://localhost:27017/pharmastock

JWT_SECRET=your_super_secret_key

CLIENT_URL=http://localhost:5173

EXPIRATION_WARNING_DAYS=30
STOCK_CHECK_INTERVAL_MS=3600000
STOCK_CHECK_ENABLED=true
```

Create a `.env` file in the frontend from `frontend/.env.example`:

``` env
VITE_API_URL=http://localhost:5000/api
```

------------------------------------------------------------------------

# 🚀 Installation

## 1. Clone the repository

``` bash
git clone https://github.com/your-username/pharmastock.git

cd pharmastock
```

## 2. Install dependencies

From the repository root:

``` bash
npm run install:all
```

Or install each package separately:

``` bash
cd frontend
npm install

cd ../backend
npm install

cd ..
npm install
```

## 3. Configure environment variables

``` bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Update the values according to your environment. Do not commit real secrets.

------------------------------------------------------------------------

# ▶️ Run the Application

## Start frontend and backend together

``` bash
npm run dev
```

## Start Backend only

``` bash
cd backend

npm run dev
```

Backend:

``` text
http://localhost:5000
```

Health check:

``` http
GET http://localhost:5000/api/health
```

## Start Frontend only

``` bash
cd frontend

npm run dev
```

Frontend:

``` text
http://localhost:5173
```

------------------------------------------------------------------------

# 🐳 Docker

Run the complete application:

``` bash
docker compose up --build
```

Run in detached mode:

``` bash
docker compose up -d
```

Stop containers:

``` bash
docker compose down
```

View logs:

``` bash
docker compose logs -f
```

------------------------------------------------------------------------

# 🧪 Testing

Frontend tests:

``` bash
cd frontend
npm run test
```

Backend tests:

``` bash
cd backend
npm run test
```

The project should include unit and integration tests for:

-   Authentication
-   Medicines
-   Stock
-   Sales
-   Purchases
-   Alerts
-   Permissions

------------------------------------------------------------------------

# 📈 Monitoring

PharmaStock can expose Prometheus metrics:

``` http
GET /metrics
```

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

The project can use GitHub Actions or Jenkins.

Pipeline:

``` text
Git Push
   ↓
Checkout
   ↓
Install Dependencies
   ↓
Run Tests
   ↓
Build Frontend
   ↓
Build Backend
   ↓
Build Docker Images
   ↓
Push Images
   ↓
Deploy
```

------------------------------------------------------------------------

# 🐳 Production Architecture

``` text
                    Internet
                       │
                       ▼
                    Nginx
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
          React               Express
        Frontend                API
                                │
                                ▼
                             MongoDB
                                │
                       ┌────────┴────────┐
                       │                 │
                       ▼                 ▼
                   Prometheus         Backup
                       │
                       ▼
                    Grafana
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

-   [ ] Sales
-   [ ] Purchases
-   [ ] Automatic stock updates
-   [ ] Sales history
-   [ ] Purchase history
-   [ ] Transaction details

## Phase 8 --- Dashboard & Reports

-   [ ] Dashboard
-   [ ] Statistics
-   [ ] Charts
-   [ ] Sales reports
-   [ ] Stock reports
-   [ ] Expiration reports
-   [ ] Profit reports
-   [ ] PDF export
-   [ ] Excel export

## Phase 9 --- DevOps

-   [ ] Docker
-   [ ] Docker Compose
-   [ ] Nginx
-   [ ] CI/CD
-   [ ] Docker image publishing
-   [ ] Prometheus
-   [ ] Grafana
-   [ ] Production deployment

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
