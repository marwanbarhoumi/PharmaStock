# PharmaStock Auth Service

Owns authentication, users, JWT issuance/verification, and audit-log reads.

## Responsibilities

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/audit-logs` (ADMIN)
- `POST /internal/auth/introspect` (service-to-service; not via Gateway)

Shares the existing MongoDB database `pharmastock` (`users`, `audit_logs`).

## Local development

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Default port: `5002`.

## Docker

Started by root `docker-compose.yml` as service `auth`. Gateway routes `/api/auth/*` and `/api/audit-logs` here. Every other service uses `AUTH_SERVICE_URL` for JWT + `isActive` introspection.
