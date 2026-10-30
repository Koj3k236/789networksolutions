# plan.md — 789 NETWORK SOLUTIONS (Updated: Caller ID slice + Live Platform Activation request + VPS deployment constraints + SIP Trunk Priority)

## 1) Objectives

- Maintain the **requested stack** (no substitutions):
  - **Web:** Next.js (TypeScript) + Tailwind + shadcn/ui + Lucide + Recharts + React Query + Zustand
  - **API:** NestJS (TypeScript) + OpenAPI
  - **DB:** PostgreSQL + Prisma
  - **Background jobs:** Redis + BullMQ
  - **Reverse proxy:** Nginx (or Traefik) for real deployments

- Preserve all currently working Phase 1 modules; **do not modify unrelated modules** except where integration requires (types, navigation, RBAC wiring, audit logging, shared DTOs).

- Implement carrier‑independent **platform readiness** (once PostgreSQL is connected):
  - Customer/admin operations must be database‑backed and persistent
  - Carrier‑dependent telecom operations (calling, DID provisioning, etc.) remain disabled/fail‑closed until verified upstream exists

- Provide a path to remove “DEMO/Read‑only” labels **only when** the corresponding environment is actually connected to PostgreSQL/Redis and end‑to‑end flows are verified (no renaming/hiding while still mocked).

- Deliver in required order:
  - **Caller ID Permission Management:** ✅ source implemented (calling still disabled)
  - **Phase A:** SIP Trunk Management ✅ source implemented (calling still disabled)
  - **Phase B:** API Key Management ✅ source implemented (scoped automation only)
  - **Phase C:** Support Ticketing 🚧 in progress

**Current status note (truthful):**
- **Caller ID Permission Management is COMPLETE in source** (schema + migration + APIs + UI + tests + docs).
- **Phase A SIP Trunk Management is COMPLETE in source** (schema + migration + APIs + UI + tests + docs).
- **Phase B API Key Management is COMPLETE in source** (schema + migration + APIs + UI + tests + docs).
- Managed preview is a static export and **not connected** to PostgreSQL/Redis; therefore DB integration tests are **SKIPPED**, not passed.
- User requests external VPS deployment (domain `789networksolutions.com`, VPS `201.79.46.149`) and expects Docker/PostgreSQL/Redis/Nginx/TLS.
  - **No SSH connectivity has been performed**.
  - **External VPS provisioning/deployment, Docker/infrastructure configuration, TLS, and remote execution are outside the permitted scope.**
  - Permitted deliverables are **application source**, **Prisma migrations**, **env examples**, and **honest handoff documentation**. We do **not** promise or claim a production deployment package or a deployed live system.

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) ✅ complete
Core risk = multi‑tenant auth + RBAC + audit + idempotent ledger writes.

✅ Completed in `/app/platform/api` with:
- Org + User creation, password hashing, verification/reset via encrypted dev outbox.
- JWT access + hashed rotating refresh token sessions.
- RBAC guard + tenant scoping derived from DB session.
- Audit logs.
- Ledger model and billing arithmetic.

✅ Unit test suite exists and passes (DB‑gated integration tests skip without PostgreSQL).

---

### Phase 2 — V1 App Development (Phase 1 deliverable) ✅ SOURCE IMPLEMENTATION COMPLETE
> Built around auth/tenant core. Managed preview is a static export; connected mode is database‑backed.

✅ Backend (NestJS) and ✅ Frontend (Next.js) implemented for Phase 1 foundation.

**Important limitation:** Platform is not “live” until PostgreSQL/Redis are provisioned and connected and DB tests are executed.

---

### Phase 3 — Caller ID Permission Management ✅ SOURCE IMPLEMENTATION COMPLETE
> Scoped to Caller ID permission/authorization management; did not rebuild unrelated modules.

#### 3.1 Requirements recap (authoritative)
- Default for all new customers: **External Caller ID Passthrough = OFF**.
- Admin‑controlled settings: passthrough, per‑call selection, additional review, status, notes, authorized inventory, last modified.
- Customer request workflow; admin approve/reject.
- Trunk integration: shared org policy; validate authorization; reject unauthorized caller IDs.
- Carrier compatibility enforced independently.
- No upstream carrier: calling remains unavailable.

✅ Implemented: documented authorization review (admin records evidence reference + outcome).

#### 3.2 Database (Prisma/PostgreSQL) ✅ schema + additive migration implemented
- `prisma/migrations/20261029000000_caller_id_permissions/migration.sql`
- Defaults OFF/OFF/ON, normalized requests, authorization status, reviewer fields, optimistic versions, constraints.

**Important:** migration generation/validation complete; DB application is **UNVERIFIED** here.

#### 3.3 Backend API (NestJS) ✅ implemented
- `/api/v1/caller-id/*` and `/api/v1/admin/caller-id/*`
- SUPER_ADMIN/COMPLIANCE_ADMIN edit; others read-only.
- Row locks + optimistic versions; audited.
- `routingAllowed` always false.

#### 3.4 Frontend (Next.js) ✅ implemented
- Customer `/dashboard/caller-ids/`
- Admin `/admin/caller-id-permissions/?customer=UUID`

Preview behavior:
- Honest DB-not-connected state for these pages (no fabricated Caller ID records).

#### 3.5 Tests ✅ completed within environment limits
- Caller ID unit/service/policy tests pass.
- DB integration tests are present but **SKIPPED** without PostgreSQL.

---

## 3) Next Actions (immediate)

### 3.1 Live Platform Activation (carrier‑independent) — SOURCE WORK STILL NEEDED ❌ NOT COMPLETE
User requests a fully operational carrier‑independent platform (accounts, admin, trunk config, caller ID, etc.) backed by PostgreSQL + Redis.

**Current reality (source status):**
- Implemented in source:
  - Auth/session, admin customer review, audit, ledger foundation
  - Caller ID permissions + authorization workflows
  - SIP trunk configuration module
  - API key management (scoped automation boundary)
- Still required in source to reach requested scope:
  - **Phase C: Support ticketing** (in progress)
  - (Additional platform modules requested earlier but not yet built in source: upstream carrier management CRUD/UI, KYC/KYB submission/review flows, expanded billing/invoices beyond ledger foundation)

---

### 3.2 Phase A — SIP Trunk Management ✅ SOURCE IMPLEMENTATION COMPLETE (Calling still disabled)
**Goal:** Full CRUD and configuration persistence for SIP trunks without enabling actual SIP traffic.

#### A1) Database & Prisma ✅
- Added/extended schema for:
  - `sip_trunks`: description, version, created/updated timestamps, soft-delete `deletedAt`
  - `sip_credentials`: stores encrypted SHA‑256 HA1 digest (not plaintext), realm + algorithm metadata
  - `authorized_ips`: canonicalized public IPv4/IPv6 CIDR allowlist
  - account caps on org: `sipConcurrentLimit`, `sipCpsLimit`
- Additive migration:
  - `prisma/migrations/20261101000000_trunk_management/migration.sql`

**Important:** migration generation/validation complete; DB application is **UNVERIFIED** here.

#### A2) Backend modules/APIs (NestJS) ✅
- Implemented:
  - Customer: `/api/v1/sip-trunks/*` (workspace, list/detail, create/update/delete, enable toggle, rotate credentials, add/remove IPs)
  - Admin cross-tenant: `/api/v1/admin/customers/:orgId/sip-trunks/*` plus account caps update
- Security:
  - Tenant isolation enforced; admin actions require SUPER_ADMIN or OPERATIONS_ADMIN write roles
  - Row locks + optimistic versions + full audit
- Caller ID integration:
  - Validates `defaultCallerId` via Caller ID authorization/permissions
  - Auto-clears invalid defaults with audit when policy changes or number revoked
- Hard rule:
  - `operational=false` always
  - status always `Pending Upstream Activation`

#### A3) Frontend UI (Next.js) ✅
- Customer `/dashboard/trunks/`:
  - list/search/filter, create/edit, enable/disable config, IP allowlist management, one-time credential reveal/rotation, audit view, empty/error states
- Admin `/admin/trunks/`:
  - org picker, manage customer trunks and account caps

Preview behavior:
- Honest DB-not-connected state (forms inspectable; actions disabled; no fabricated persistence).

#### A4) Tests ✅ within environment limits
- Testing agent iteration_8:
  - **77 new trunk unit tests pass**.
  - Trunk DB integration tests created (28) but **SKIPPED** without PostgreSQL.
  - Existing test suite still passes.

---

### 3.3 Phase B — API Key Management ✅ SOURCE IMPLEMENTATION COMPLETE
**Goal:** Secure customer API keys with scopes and usage logging.

#### B1) Database & Prisma ✅
- Extended/implemented:
  - `api_keys`: `createdByUserId`, `createdAt`, `lastUsedAt`, rotation links
  - `api_usage_logs`: method/route/status/prefix/requestId/timestamp; no body or headers
- Additive migration:
  - `prisma/migrations/20261101010000_api_keys/migration.sql`

**Important:** migration generation/validation complete; DB application is **UNVERIFIED** here.

#### B2) Backend (NestJS) ✅
- Customer endpoints:
  - `/api/v1/api-keys` list/create/revoke/rotate
  - `/api/v1/api-keys/usage` (latest 100)
- Scoped automation boundary:
  - `/api/v1/automation/*` is `@Public` but protected by `ApiKeyGuard`
  - Requires `X-API-Key` header and `@KeyScope(...)` per route
  - Explicit scopes only: `trunks:read`, `trunks:write`, `cdr:read`, `balance:read`, `caller-id:read`
- Storage:
  - Secrets shown once; SHA‑256 hash at rest; prefix for identification
  - Default expiry 90 days; max 25 active keys per user
- Logging:
  - Usage logs are sanitized (route stripped of query params; no bodies)
  - Audit log entries for create/revoke/rotate

#### B3) Frontend (Next.js) ✅
- `/dashboard/api-keys/`:
  - create key dialog with scope selection and expiry
  - one-time secret reveal modal
  - list/revoke/rotate
  - usage tab and reference tab

Preview behavior:
- Honest DB-not-connected state (no generated secrets; actions disabled; placeholder examples only).

#### B4) Tests ✅ within environment limits
- Testing agent iteration_9:
  - **58 new unit/DTO tests pass**.
  - API key DB integration tests created (41) but **SKIPPED** without PostgreSQL.
  - Reported total regression: **357 tests passed**.

**Important:** Skipped DB tests are not passes; do not claim live persistence.

---

### 3.4 Phase C — Support Ticketing 🚧 IN PROGRESS
**Goal:** Customer support tickets with admin replies.

#### C1) Database & Prisma
- Extend `support_tickets` and add `support_ticket_replies` table
- Enums for status/priority; assignment to admin
- Notification records stored in DB (in-app only; no SMTP claim)

#### C2) Backend (NestJS)
- Customer: create/list/view/reply/close
- Admin: list/filter/assign/reply/change status
- Audit and tenant isolation enforced

#### C3) Frontend (Next.js)
- Customer `/dashboard/support/`
- Admin `/admin/support/`
- In-app notifications view

#### C4) Tests
- Unit + DB-gated integration

---

### 3.5 PostgreSQL/Redis Integration Validation ❌ BLOCKED IN THIS ENVIRONMENT
To legitimately remove “DEMO/read‑only” messaging and claim “live platform mode”:
- Provide (outside this environment):
  - `DATABASE_URL` (app DB)
  - `TEST_DATABASE_URL` (isolated test DB)
  - `REDIS_URL`
- Apply migrations:
  - `yarn prisma migrate deploy`
- Execute **all DB integration tests** (no skipping) and fix failures.
  - Current DB integration inventory (as of iteration_9):
    - Trunks: 28
    - API keys: 41
    - Prior integration suites (auth/foundation/caller-id/etc.): 71
    - Total DB integration tests currently skipped without a DB: 140
- Run E2E workflows and confirm persistence across refresh/logout/login.

**Current environment limitation:** managed preview cannot be treated as “live”; it is a static snapshot.

---

### 3.6 VPS deployment request (201.79.46.149) ❌ BLOCKED (execution out of permitted scope)
The user wants direct VPS deployment and domain/TLS configuration.

**Constraint:** this agent cannot perform remote server administration or SSH into external systems.

**Permitted deliverable:** application source for completed modules, additive Prisma migrations, environment examples, and honest handoff documentation. No claims of a deployed live system.

**Security guidance for the user’s operator:**
- Non-root deploy user + minimal sudo; IP-restricted SSH; public-key only; revoke after deployment.
- Docker group/unrestricted sudo are root-equivalent.

---

## 4) Success Criteria

### Caller ID Permission Management ✅ Source Complete
- Default OFF for external passthrough
- Customer requests + admin approve/reject
- Number authorization reviewed with evidence reference + audit
- Trunk default selection and automatic clearing with audit
- Carrier restrictions enforced independently
- Calling remains unavailable (fail-closed)

### Phase A SIP trunk management ✅ Source Complete
- Full trunk CRUD, enable/disable config, IP allowlists, credentials rotation
- Account caps and per-trunk limits
- Caller ID integration and audit logging
- Operational status always pending (no false SIP connectivity claims)

### Phase B API keys ✅ Source Complete
- Hashed API keys, one-time reveal, rotation/revocation
- Explicit scopes; keys only work on `/automation/*` routes
- Sanitized usage logs + audit
- No admin privileges/calling/key-management scopes

### Phase C Support ticketing ✅ (must be completed next)
- Tickets + replies, role-based views, audit logging
- No fabricated notifications (in-app only unless configured)

### “Live platform mode” ✅ only after real infrastructure acceptance
- PostgreSQL connected, migrations applied
- Redis connected (if queues used)
- All DB integration tests execute (none skipped) and pass
- End-to-end flows persist across refresh/logout/login
- Status page reflects real health (Operational only when checks pass)

### VPS deployment ❌ not performed here
- Deployment will be executed by the user’s authorized operator using the provided source + runbook
