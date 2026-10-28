# plan.md — 789 NETWORK SOLUTIONS (Updated: Caller ID slice + Live Platform Activation + VPS Deployment Request)

## 1) Objectives

- Maintain the **requested stack** (no substitutions):
  - **Web:** Next.js (TypeScript) + Tailwind + shadcn/ui + Lucide + Recharts + React Query + Zustand
  - **API:** NestJS (TypeScript) + OpenAPI
  - **DB:** PostgreSQL + Prisma
  - **Background jobs:** Redis + BullMQ
  - **Reverse proxy:** Nginx (or Traefik) for real deployments

- Preserve all currently working Phase 1 modules; **do not modify unrelated modules** except where integration requires (types, navigation, RBAC wiring, audit logging, shared DTOs).

- Implement carrier‑independent **platform readiness**:
  - Customer/admin operations must be database‑backed and persistent
  - Carrier‑dependent telecom operations (calling, DID provisioning, etc.) remain disabled/fail‑closed until verified upstream exists

- Provide a path to remove “DEMO/Read‑only” labels **only when** the corresponding environment is actually connected to PostgreSQL/Redis and end‑to‑end flows are verified.

- Add a realistic, auditable **Caller ID permission management** system (already implemented in source) that:
  - Defaults OFF for external passthrough
  - Separates customer permission from number authorization evidence and carrier policy
  - Produces complete audit logs and safe fail‑closed routing decisions

**Current status note (truthful):**
- **Caller ID permission source slice is COMPLETE** (schema + migration + APIs + UI + tests + docs).
- In the managed preview environment, **PostgreSQL/Redis are not connected** (credentials were skipped earlier). Therefore:
  - All PostgreSQL integration tests are correctly **SKIPPED**, not passed.
  - Managed preview must remain “read‑only / not connected” and must not pretend to be live.
- User now requests **VPS deployment** (201.79.46.149) with Docker/PostgreSQL/Redis/Nginx.
  - **No SSH connectivity has been performed**, port 22 is not verified.
  - The requested VPS provisioning/deployment steps are **outside this agent’s permitted scope** (no remote server administration from here). This plan therefore treats VPS deployment as **BLOCKED** and provides a safe handoff approach.

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) ✅ complete
Core risk = multi‑tenant auth + RBAC + audit + idempotent ledger writes.

✅ Completed in `/app/platform/api` with:
- Org + User creation, password hashing, verification/reset via encrypted dev outbox.
- JWT access + hashed rotating refresh token sessions.
- RBAC guard + tenant scoping derived from DB session.
- Audit logs.
- Ledger model and demo billing arithmetic.

✅ Unit test suite exists and passes (DB‑gated integration tests skip without PostgreSQL).

---

### Phase 2 — V1 App Development (Phase 1 deliverable) ✅ SOURCE IMPLEMENTATION COMPLETE
> Built around auth/tenant core. Managed preview is a static export; connected mode is database‑backed.

✅ Backend (NestJS) and ✅ Frontend (Next.js) implemented for Phase 1.

**Important limitation:** Platform is not “live” until PostgreSQL/Redis are actually provisioned and connected.

---

### Phase 3 — Caller ID Permission Management ✅ SOURCE IMPLEMENTATION COMPLETE
> This work was scoped to Caller ID permission/authorization management and intentionally did not rebuild unrelated modules.

#### 3.1 Requirements recap (authoritative)
- Default for all new customers: **External Caller ID Passthrough = OFF**.
- Admin‑controlled settings under Customer Management → Caller ID Permissions:
  - External Caller ID Passthrough ON/OFF
  - Allow Per‑Call Caller ID Selection ON/OFF
  - Require Additional Caller ID Review ON/OFF
  - Permission Status, Approval Notes
  - Authorized Number Inventory
  - Last Modified By / Date
- Customer request workflow to enable passthrough; admin approve/reject.
- SIP trunk integration: shared policy across trunks; validate authorization; reject unauthorized Caller ID.
- Carrier compatibility is independent and must still block unsupported behavior.
- No upstream carrier exists: calling remains unavailable.

✅ Implemented approach: documented authorization review (admin records evidence reference + outcome; no verification calls implied).

#### 3.2 Database (Prisma/PostgreSQL) ✅ schema + additive migration implemented
✅ Added:
- Org permission defaults (DB‑level defaults)
- Normalized `CallerIdPermissionRequest` + partial unique index for one pending request per org
- Caller ID authorization status + review metadata + optimistic versioning
- Constraints ensuring “enabled implies approved”

Migration file:
- `prisma/migrations/20261029000000_caller_id_permissions/migration.sql`

**Important:** Migration generation/validation complete; actual application to PostgreSQL is **UNVERIFIED** here.

#### 3.3 Backend API (NestJS) ✅ implemented
✅ Added caller-id module:
- `api/src/caller-id/policy.ts`, `dto.ts`, `caller-id.service.ts`, `caller-id.controller.ts`
- Wired into `api/src/app.module.ts`

Key behavior:
- Only SUPER_ADMIN / COMPLIANCE_ADMIN can approve/reject or modify customer permission state.
- Row locks + optimistic versions.
- Carrier compatibility gate evaluated separately.
- `routingAllowed` always false; calling remains unavailable.

#### 3.4 Frontend (Next.js) ✅ implemented
✅ Pages:
- Customer: `/dashboard/caller-ids/`
- Admin: `/admin/caller-id-permissions/?customer=UUID`
- Admin customer detail links to Caller ID permissions.

Preview behavior:
- Shows an honest “database not connected” state when not authenticated/connected.
- Does not fabricate customer requests/inventory.

#### 3.5 Tests ✅ completed within environment limits
- 222 unit/source tests pass
- 43 PostgreSQL integration tests are **SKIPPED** (no TEST_DATABASE_URL)
- Testing agent verification report: `/app/test_reports/iteration_7.json`

---

## 3) Next Actions (immediate)

### 3.1 Live Platform Activation (carrier‑independent) — SOURCE WORK STILL NEEDED ❌ NOT COMPLETE
The user requested these modules be fully operational with PostgreSQL + Redis:
- Customer registration/login/profile
- Admin approvals/permissions
- SIP trunk CRUD + credential/IP auth config (storage only; no SIP connectivity claims)
- API key management
- KYC/KYB submission + review
- Upstream carrier configuration UI + encrypted credential storage + rate import plumbing
- Billing configuration + internal ledger
- Support ticket management
- Audit logs

**Current reality:**
- Some are implemented (auth, admin customer review, audit, ledger foundation, Caller ID slice).
- Several remain **unfinished** (full SIP trunk CRUD flows, API key module, support tickets module UI/API, upstream carrier configuration UI/API, billing/invoicing workflows, KYC/KYB document flows).

**Planned work (inside application source, allowed scope):**
1. Implement remaining CRUD modules in NestJS + Next.js with full persistence contracts:
   - SIP trunks CRUD + credentials rotation + authorized IPs
   - API keys CRUD (hashed storage, scoped permissions)
   - KYC/KYB request submissions (metadata only until secure uploads exist)
   - Support tickets CRUD + replies (attachments deferred)
   - Upstream carriers CRUD + encrypted creds + capability flags (still no real carrier actions without integration)
   - Billing admin adjustments + invoices scaffolding (no payment gateway)
2. Convert existing “demo dataset” UX to an explicit **dev-only seed tool** (not default).
3. Add real platform health endpoints:
   - DB connectivity check
   - Redis connectivity check
   - Worker queue check
   - Strict status display rules (Operational only when checks pass)

**Acceptance gate:** must run against real PostgreSQL/Redis and pass full integration tests.

### 3.2 PostgreSQL/Redis Integration Validation ❌ BLOCKED IN THIS ENVIRONMENT
To legitimately remove “DEMO/read‑only” messaging:
- Provide:
  - `DATABASE_URL` (app DB)
  - `TEST_DATABASE_URL` (isolated test DB)
  - `REDIS_URL`
- Apply migrations:
  - `yarn prisma migrate deploy`
- Run **all** integration tests (currently 43 skipped; will grow as modules complete)
- Perform E2E workflow verification:
  - register → verify → login → create trunk/caller IDs → admin approvals → persistence after relog

**Current environment limitation:** managed preview cannot be treated as “live”; it is a static snapshot.

### 3.3 VPS deployment request (201.79.46.149) ❌ BLOCKED (out of permitted scope)
The user requested:
- OS/resource/service inventory
- Docker/PostgreSQL/Redis/Nginx setup
- Dedicated non-root deploy user
- Safe temporary SSH access method
- No disruption of existing services

**Constraint:** this agent cannot perform remote server administration from here.

**Safe handoff plan for the user’s operator (recommended):**
1. Create a dedicated non-root deployment user (e.g., `deploy`) and grant only the minimal required sudo commands.
   - Note: docker group membership and unrestricted sudo are effectively root; treat accordingly.
2. Temporary access:
   - Operator generates their own SSH keypair locally.
   - Only the public key is installed on the VPS.
   - Restrict by source IP, use short-lived keys/SSH certificates if possible, and revoke after deployment.
3. Operator performs inventory and non-disruptive installation.
4. Operator runs the app via Docker Compose (once the project includes it) and confirms health checks.

**Permitted assistance from this agent:**
- Continue application-source fixes, document service contracts and verification prerequisites, and review sanitized operator diagnostics.
- Do not create or alter Docker/infrastructure configuration or perform the external production deployment under the current operational boundary. An authorized external operator must supply that work.
- SSH port 22 is the standard default, not verified for this host. No connection, inventory, installation or deployment has been performed.
- Do not collect an SSH private key or root password for an action this agent cannot perform. MongoDB Atlas is not PostgreSQL and cannot substitute for this project's database.

---

## 4) Success Criteria

### Caller ID Permission Management ✅ Source Complete
- Default OFF for external passthrough
- Customer requests + admin approve/reject
- Number authorization reviewed with evidence reference + audit
- Trunk default selection and automatic clearing with audit
- Carrier restrictions enforced independently
- Calling remains unavailable (fail-closed)

### “Live platform mode” ✅ only after real infrastructure acceptance
To remove demo/read-only banners and claim the platform is live:
- PostgreSQL connected, migrations applied
- Redis connected (if queue endpoints used)
- End-to-end workflows persist across refresh/logout/login
- All DB integration tests execute (none skipped) and pass
- Status page reflects real health:
  - Platform Operational only when health checks pass
  - Customer/Admin portals online
  - DB Connected
  - Upstream Carrier Awaiting Integration
  - SIP Calling Pending Carrier Activation
  - Payments Pending Integration

### VPS deployment ❌ not performed here
- Requires an authorized operator with SSH access and infra privileges.
- Plan/documentation can be produced in-source; remote execution cannot be claimed completed by this agent.
