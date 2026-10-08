# PharmaStock Medicine Service

Owns medicine catalog: medicines, categories, barcode lookup.

## Responsibilities

- `GET/POST /api/medicines`, `GET/PUT/DELETE /api/medicines/:id`
- `GET /api/medicines/barcode/:barcode`
- `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/:id`
- `POST`-style internal reads: `GET /internal/catalog/medicines/:id` (etc.)

Shares MongoDB database `pharmastock` (`medicines`, `categories`).
Reads `batches` / `suppliers` for detail enrichment and supplier validation only.

## Auth

Uses Auth Service introspection (`AUTH_SERVICE_URL`) in Docker.
Local tests can omit it and fall back to JWT + User lookup.

## Local development

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Default port: `5003`.
