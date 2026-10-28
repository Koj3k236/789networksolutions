# Setup — Windows, VS Code, and compatible Linux hosting

## 1. Prerequisites

- Node.js 20.20+ (or supported current LTS), Yarn Classic 1.22, VS Code, and Git.
- A PostgreSQL 16+ service and a database/user owned by your development team.
- Redis 7+ if you want to run manual BullMQ jobs. HTTP account/dashboard functionality does not require the worker; queue endpoints report unavailable when Redis is not configured.
- No upstream carrier is needed. Keep `APP_MODE=DEMO`.

**Docker boundary:** no Docker/Compose configuration is supplied or executed in this build. If you use Docker Desktop on Windows or Docker on a VPS, have your infrastructure engineer provide PostgreSQL/Redis and application service orchestration following the service contract below. This document is not a tested `docker compose up` runbook. Alternatively, use compatible pre-existing local PostgreSQL and Redis services.

## 2. Open source in VS Code

Extract the downloaded archive. Open its `platform` folder in VS Code. In the integrated PowerShell terminal:

```powershell
yarn install --frozen-lockfile
node tools/init-local.cjs
```

The initializer creates `platform/.env` and `platform/web/.env.local` locally, with unique random JWT/encryption/seed-password values. It refuses to overwrite an existing environment file and prints no secrets. Keep environment files out of version control. Configure the PostgreSQL connection in the local `.env` for the database provisioned by your team; configure Redis if used. These are local development service values, not an upstream-carrier integration.

Defaults:
- API: `http://localhost:8001`, prefix `/api/v1`
- Web: `http://localhost:3000`
- `WEB_ORIGIN=http://localhost:3000`
- `NEXT_PUBLIC_API_BASE=http://localhost:8001/api/v1`
- `NEXT_PUBLIC_PREVIEW=false`

Do not set `NEXT_PUBLIC_PREVIEW=true` if you want working backend interactions. It deliberately disables all writes.

## 3. Generate and apply schema

From the `platform` directory:

```powershell
yarn prisma generate
yarn prisma validate
yarn prisma migrate deploy
```

The migration creates the foundation and future-facing schema. It has been generated and statically validated, but not applied to PostgreSQL in the managed preview. Use a fresh development database and inspect migrations before applying them anywhere valuable. Do not run reset or destructive migration commands against production.

## 4. Compile and start the API

Terminal A, working directory `platform`:

```powershell
yarn tsc -p api/tsconfig.json
node api/dist/main.js
```

The API must fail startup if PostgreSQL is unreachable or required configuration is missing. There is no MongoDB, SQLite, memory-store, or FastAPI fallback. `APP_MODE=STAGING` and `PRODUCTION` are rejected in Phase 1.

## 5. Start the frontend

Terminal B, working directory `platform`:

```powershell
yarn next dev web
```

Open `http://localhost:3000/company/` for the public website or `/login/` for the portal. Next loads `web/.env.local`. If changing frontend environment values, restart/rebuild Next.

## 6. Accounts and verification

Option A: register a new account at `/register/`. All specified business fields are available; optional website/registration/tax ID can be omitted. Passwords require 12 characters and matching confirmation. The account starts pending verification, with a DEMO-only wallet and no live calling access.

**No email is sent.** For local developers with trusted database access, retrieve only the relevant development message:

```powershell
yarn tsx prisma/read-outbox.ts owner@example.com
```

This trusted CLI intentionally displays the single-use development link. Do not run it in shared logs or production. The link uses a URL fragment; the browser removes the fragment after reading it. Verification moves a pending account to under review, not production approved.

Option B: populate dedicated demo customer and admin accounts using the environment-generated seed values:

```powershell
yarn tsx prisma/seed.ts
```

Use `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` or the customer equivalents from your local environment manager to sign in. No public default password is baked into the code. Seeded users are explicitly development accounts, not real KYC approvals. The seed is idempotent and will not reset an existing user's password or elevate an existing account.

- Customer: `/dashboard/`
- Admin: `/admin/`; server checks role on every administration endpoint.
- Verification queue: `/admin/verification/`. Only Super Admin and Compliance Admin can change demo account status. A review reason is required. Suspension revokes refresh sessions.
- Password reset: `/forgot-password/`; retrieve the development message as above.
- TOTP: Settings → Set up 2FA → manually add secret to authenticator → enter six-digit code. Back up the authenticator. Recovery-code, disable, and administrator recovery workflows are not implemented yet; do not rely on this build for production identity recovery.

## 7. Persist demo activity

From the customer dashboard click **Load demo data**. This calls `POST /api/v1/demo/dataset`, creates 96 labeled simulated CDRs, three inactive trunks, and audited test ledger entries inside a PostgreSQL transaction. A tenant-scoped advisory lock and unique idempotency keys prevent duplicate loads. Calls are not placed, SIP passwords are not generated, and real money is not accepted.

Registering a new account does not silently populate sample usage; empty states are expected until you choose this action.

## 8. Optional Redis/BullMQ worker

Terminal C, working directory `platform`:

```powershell
node api/dist/worker.js
```

The authenticated `POST /api/v1/demo/jobs` enqueues the same idempotent dataset operation. Worker completion is not represented as immediate success: the API returns `QUEUED`. There is no recurring schedule, automatic timer, or cron job in this phase. Redis/worker execution is unverified in the managed environment.

## 9. Tests and builds

```powershell
yarn tsc -p api/tsconfig.json
yarn vitest run
yarn next build web
```

Unit tests use compiled `api/dist` code. Database integration cases skip unless `TEST_DATABASE_URL` is supplied for a separate disposable database with the migration already applied. Never point it at production/customer data. Review `tests/integration.test.ts` before running; it creates and cleans up only its own test tenants.

For integration migration use the isolated test connection as `DATABASE_URL` only in that terminal, apply `prisma migrate deploy`, then set `TEST_DATABASE_URL` to the same isolated connection and run `yarn vitest run tests/integration.test.ts`. Tests account for request throttles and can take longer than unit checks.

The Next build uses static export and writes `web/out`; static hosting is compatible with the separate Nest API. For server-hosted Next features in later phases, revisit the export configuration.

## 10. Linux/VPS hosting contract (not a deployment performed here)

Use a supported Linux host and a managed process supervisor for the compiled API and worker. Build static Next assets with the backend URL for that host. Serve the web export and API under the same HTTPS site where possible, routing `/api/*` to the API. Configure `WEB_ORIGIN` to the exact browser origin, set `COOKIE_SECURE=true`, and `NODE_ENV=production` for HTTPS hosting. **Keep APP_MODE=DEMO.** Web-hosting production mode does not authorize real calling.

The infrastructure owner must supply:
1. PostgreSQL/Redis persistence, isolated network access, strong credentials, backups and restore verification.
2. Non-root app containers/processes, CPU/memory limits, graceful shutdown, and health probes.
3. HTTPS termination, appropriate trusted-proxy configuration, firewalling, logs/metrics, and alerting.
4. A one-shot migration step and release/rollback process.
5. Dependency scanning and secret rotation runbooks.

### Container service contract (orchestrator configuration outstanding)

| Service | Artifact / command | Port | Dependencies | Persistent data |
|---|---|---|---|---|
| Web | Next static `web/out` behind an HTTP server | Host-selected HTTP(S) | API browser URL baked into build | None |
| API | `node api/dist/main.js` | 8001 | PostgreSQL; Redis for queue endpoint | None locally |
| Worker | `node api/dist/worker.js` | None | PostgreSQL + Redis | Job state in Redis |
| PostgreSQL | Version 16+ | Private 5432 | None | Database volume |
| Redis | Version 7+ | Private 6379 | None | Queue persistence |
| Migration | `yarn prisma migrate deploy` | None | PostgreSQL | Migration history |
| SIP/media | Not implemented in Phase 1 | Do not expose | Future verified edge/carrier | Future state |

Do not expose SIP 5060/5061 or RTP port ranges on the assumption this web application implements those protocols. It does not.
