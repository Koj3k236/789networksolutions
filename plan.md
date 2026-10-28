# plan.md — 789 NETWORK SOLUTIONS (Updated: Caller ID Permission Management)

## 1) Objectives
- Maintain the **requested stack** (no substitutions):
  - **Web:** Next.js (TypeScript) + Tailwind + shadcn/ui + Lucide + Recharts + React Query + Zustand
  - **API:** NestJS (TypeScript) + OpenAPI
  - **DB:** PostgreSQL + Prisma
  - **Background jobs:** Redis + BullMQ (optional; explicit failure if Redis not configured)
- Preserve all currently working Phase 1 modules; **do not modify unrelated modules** except where integration requires (types, navigation links, RBAC wiring, audit logging).
- Implement **carrier-independent** Caller ID Permission Management:
  - Per-customer administrative permission toggles and approval workflow for **External Caller ID Passthrough**
  - Enforce capability boundaries: calling remains unavailable; carrier capability restrictions must not be bypassed
  - Provide complete **audit logging** and **tenant isolation**
- Ensure **real persistence** (no fake production data):
  - All new Caller ID permission settings, requests, decisions, and authorized inventory stored in PostgreSQL **when a DATABASE_URL is configured**
  - No simulated “connected” SIP state; no fabricated upstream results

**Current status note (final, updated):**
- Caller ID source milestone is **COMPLETED** (schema, migration, APIs, UI, tests, docs).
- The user **skipped** secure configuration for `DATABASE_URL` / `TEST_DATABASE_URL`. Therefore:
  - We implemented complete source changes and generated/validated migrations,
  - but PostgreSQL-backed persistence is **BLOCKED/UNVERIFIED** in this environment,
  - integration tests are correctly **SKIPPED** (not “passed”),
  - and managed preview shows an explicit **DB-unavailable** state for this module (no fake Caller ID records, no fake “save success”).

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) ✅ complete
Core risk = multi-tenant auth + RBAC + audit + idempotent ledger writes.

✅ Completed in `/app/platform/api` with:
- Org + User creation, password hashing, verification/reset via encrypted dev outbox.
- JWT access + hashed rotating refresh token sessions.
- RBAC guard + tenant scoping derived from DB session.
- Audit logs.
- Ledger model and demo billing arithmetic.

✅ Unit test suite exists and passes (DB-gated integration tests skip without PostgreSQL).

---

### Phase 2 — V1 App Development (Phase 1 deliverable) ✅ SOURCE IMPLEMENTATION COMPLETE
> Built around auth/tenant core. Managed preview remains a read-only snapshot only; connected mode is database-backed.

✅ Backend (NestJS) and ✅ Frontend (Next.js) implemented for Phase 1.

---

### Phase 3 — Caller ID Permission Management (CURRENT SCOPE) ✅ SOURCE IMPLEMENTATION COMPLETE
> **This update remained narrowly scoped to Caller ID Permission Management only.**

#### 3.1 Requirements recap (authoritative)
- Default for all new customers: **External Caller ID Passthrough = OFF**.
- Admin-controlled settings under Customer Management → Caller ID Permissions:
  - External Caller ID Passthrough: ON/OFF
  - Allow Per-Call Caller ID Selection: ON/OFF
  - Require Additional Caller ID Review: ON/OFF
  - Caller ID Permission Status
  - Approval Notes
  - Authorized Number Inventory
  - Last Modified By
  - Last Modified Date
- Customers can submit request to enable External Caller ID Passthrough.
- Admin can approve/reject; approval does **not** imply number ownership verification is complete; it is a platform permission gate.
- SIP trunk integration requirements:
  - When enabled: allow selection among authorized external Caller IDs
  - Apply across all customer trunks
  - Validate before routing; reject unauthorized Caller ID values
- Carrier compatibility is independent: carrier-specific policies must still be enforced.
- No upstream carrier exists: actual calling must remain unavailable.

**Caller ID verification approach:** documented authorization review (staff reviews submitted evidence; no verification calls implied).

#### 3.2 Database (Prisma/PostgreSQL) ✅ implemented in schema + additive migration
**Implemented approach:** normalized records (no “string[] as database”).

✅ Implemented in `prisma/schema.prisma`:
- **Organization-level defaults** (applies automatically to all new customers via DB defaults):
  - `externalCallerIdPassthroughEnabled` default `false`
  - `allowPerCallCallerIdSelection` default `false`
  - `requireAdditionalCallerIdReview` default `true`
  - `callerIdPermissionStatus` enum default `DISABLED`
  - `callerIdApprovalNotes`, `callerIdPermissionsUpdatedAt`, `callerIdPermissionsUpdatedById`
  - optimistic concurrency: `callerIdPermissionVersion`
- **Normalized request workflow**:
  - `CallerIdPermissionRequest` with `PENDING/APPROVED/REJECTED/CANCELLED` and reviewer metadata
  - partial unique index: one pending request per org
- **External Caller ID authorization state (separate from permission):**
  - `CallerId.status` (`PENDING/AUTHORIZED/REJECTED/REVOKED`)
  - evidence reference, additional review timestamp, expiry, `version` (optimistic)
  - `CallerIdVerification` extended with review notes, evidence reference and reviewer identity

✅ Additive migration generated:
- `prisma/migrations/20261029000000_caller_id_permissions/migration.sql`
- Adds constraints:
  - one pending request per org (partial unique index)
  - “enabled requires approval” check constraint

**Important constraint:** migration generation/validation is complete, but applying migrations and validating persistence is **UNVERIFIED** here.

#### 3.3 Backend API (NestJS) ✅ implemented
✅ Implemented slice:
- `api/src/caller-id/policy.ts` (fail-closed evaluator)
- `api/src/caller-id/dto.ts`
- `api/src/caller-id/caller-id.service.ts`
- `api/src/caller-id/caller-id.controller.ts`
- wired into `api/src/app.module.ts`

**Customer endpoints (tenant scoped):**
- `GET /api/v1/caller-id/workspace`
- `POST /api/v1/caller-id/requests`
- `DELETE /api/v1/caller-id/requests/:id`
- `POST /api/v1/caller-id/inventory`
- `DELETE /api/v1/caller-id/inventory/:id`
- `PATCH /api/v1/caller-id/trunks/:id/default`
- `POST /api/v1/caller-id/validate` (audited diagnostic; does not originate calls)

**Admin endpoints (RBAC):**
- `GET /api/v1/admin/caller-id/requests`
- `GET /api/v1/admin/caller-id/customers/:orgId`
- `PATCH /api/v1/admin/caller-id/customers/:orgId/permissions`
- `POST /api/v1/admin/caller-id/customers/:orgId/requests/:id/decision`
- `POST /api/v1/admin/caller-id/customers/:orgId/inventory/:id/review`

**Validation + fail-closed behavior:**
- Editable roles: **SUPER_ADMIN**, **COMPLIANCE_ADMIN** only; other admin roles read-only.
- All writes are transactional and write audit logs.
- Row-locking + optimistic version checks for org and caller ID updates.
- Shared policy function returns:
  - `customerPermissionAllowed`
  - `carrierPolicyAllowed` (separate gate)
  - `routingAllowed` **always false**
  - reason codes and explicit service status: `Pending Upstream Activation`

**SIP signaling note:** `resolveSignaledIdentity()` is a helper for a future trusted SIP edge, rejects conflicting identities. No SIP edge exists.

#### 3.4 Frontend (Next.js) ✅ implemented
Design reference: **/app/caller_id_design_guidelines.md**.

✅ Customer portal:
- `/dashboard/caller-ids/`
  - Tabs: Permissions / Authorized inventory / My requests / SIP trunk defaults / Audit history
  - Professional “Pending Upstream Activation” status language
  - Honest **DB not connected** state in preview (no fake data, no fake mutation success)

✅ Admin portal:
- `/admin/caller-id-permissions/` (supports `?customer=`)
  - Customer selector
  - Permissions editing for SUPER/COMPLIANCE admins only
  - Queue and review views
- Entry point link added from Admin → Customers → customer detail dialog

✅ UX requirement satisfied:
- New Caller ID module screens do **not** show the old demo banner or any fabricated Caller ID data.
- Existing unrelated mock dashboard pages remain unchanged.

#### 3.5 Tests (mandatory) ✅ completed for unit/static checks; DB acceptance remains blocked
✅ Implemented tests:
- `tests/caller-id-unit.test.ts` — policy/service/DTO behavior with mocked Prisma
- `tests/caller-id-integration.test.ts` — **DB-gated** PostgreSQL tests (skipped without TEST_DATABASE_URL)

✅ Verified after manual defect fixes:
- Integration suite safety guards:
  - DB safety check uses URL pathname (database name), not substring search
  - fixture IDs reset per-test; cleanup guarded by tracked IDs
  - assigned-number fixture uses ACTIVE/PRODUCTION in isolated test DB only; organizations remain DEMO/calling disabled

**Final test status (testing agent iteration_7):**
- **222 checks passed** (77 new Caller ID behavioral checks + 145 prior unit/source)
- **43 integration tests skipped** (24 new Caller ID integration + 19 previous integration)
- TypeScript compilation succeeded for API and tests.
- Browser verification confirmed disconnected-state UI does not claim writes.

**Testing requirement satisfied:** `testing_agent_v3` verification report exists: `/app/test_reports/iteration_7.json`.

---

## 3) Next Actions (immediate)

### 3.1 Completed deliverables in this scope ✅
- Caller ID permission schema + migration
- Tenant-scoped APIs + policy evaluator
- Customer/admin UI surfaces + navigation
- Unit tests + DB-gated integration tests
- Documentation: `docs/CALLER-ID.md` and updates to README/STATUS/VERIFICATION/PRD
- Source ZIP updated and downloadable

### 3.2 Acceptance gate: PostgreSQL-backed validation (BLOCKED)
Because the user skipped providing `DATABASE_URL` and `TEST_DATABASE_URL`:
- We **must not** claim migrations executed, persistence validated, or DB integration tests passed.

**Next required external acceptance steps (on a compatible machine):**
1. Provide `DATABASE_URL` (app database) and `TEST_DATABASE_URL` (separate isolated test DB).
2. Apply migrations:
   - `yarn prisma migrate deploy`
3. Run integration tests:
   - `TEST_DATABASE_URL=... yarn vitest run tests/integration.test.ts tests/caller-id-integration.test.ts`
4. Validate end-to-end workflows:
   - Customer request → admin approve/reject
   - Number submission → evidence review → authorized/revoked
   - Trunk default set → permission revoked → trunk default cleared + per-trunk audit
   - Tenant isolation across organizations

### 3.3 Keep calling unavailable and carrier independent
- Do not enable outbound/inbound calling.
- Per-call selection is stored configuration + validation rule only.
- Carrier compatibility remains a separate gate from customer permission.

---

## 4) Success Criteria

### Caller ID Permission Management ✅ Source Complete
- New customers default to passthrough OFF and per-call OFF; additional review ON.
- Customer can request passthrough; admin can approve/reject with notes.
- External Caller ID inventory supports submit → documented review → authorize/reject/revoke.
- Trunk defaults can be set only from authorized inventory and cleared on invalidation (with per-trunk audit).
- Tenant isolation enforced by server-side session principal + org ID scoping + row locks.
- UI shows accurate states and never claims carrier/SIP readiness.

### Testing and verification ✅ Completed within environment limits
- Unit tests for permission logic, RBAC, DTO validation and policy evaluation pass.
- `testing_agent_v3` report confirms:
  - Correct workflow behavior at the unit level
  - No false operational claims
  - No regressions in existing modules
  - DB-unavailable states are honest (no fabricated persistence)

### DB acceptance ❌ Not complete
- DB migrations + persistence + 43 integration tests remain **blocked/unverified** until PostgreSQL connection strings are provided and executed in a compatible runtime.