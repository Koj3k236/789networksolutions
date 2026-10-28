# plan.md — 789 NETWORK SOLUTIONS (Phase 1 Foundation)

## 1) Objectives
- Deliver Phase 1 foundation on the **requested stack** (no stack substitution):
  - **Web:** Next.js (TypeScript) + Tailwind + shadcn/ui + Lucide + Recharts + React Query + Zustand
  - **API:** NestJS (TypeScript) + OpenAPI
  - **DB:** PostgreSQL + Prisma
  - **Background jobs:** Redis + BullMQ (optional; fail explicitly if Redis not configured)
- Provide a **carrier-independent architecture**:
  - `UpstreamCarrierAdapter` interface
  - `MockCarrierAdapter` (explicitly simulated)
  - Generic SIP/REST adapters that **fail closed** with explicit capability errors
  - **No upstream carrier is connected**; the platform must never present simulated activity as real.
- Ensure **persistent, tenant-safe authentication + RBAC + audit**:
  - scrypt password hashing
  - access JWT + rotating refresh token sessions (hashed in DB)
  - dev outbox for email verification/reset (explicitly local-only)
  - optional TOTP enroll/enable + replay prevention
  - role-guarded admin endpoints and strict tenant scoping
  - account status enforcement (suspend/reject blocks access)
- Deliver a professional, original UI/UX (dark/light) and **explicit DEMO boundary**:
  - persistent DEMO disclosures
  - write operations either functional (connected local mode) or explicitly unavailable
  - **Managed preview is READ-ONLY SNAPSHOT** (no writes and no “success” fakery)
- Ship full repository structure, forward-looking Prisma schema + baseline SQL migration, docs, and downloadable source.

**Current status note:** Phase 1 **source implementation milestone is complete** and **available-environment verification is complete**, but full Phase 1 acceptance remains **BLOCKED** on a compatible PostgreSQL/Redis runtime (see §3 Next Actions).

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) ✅ required
Core risk = **multi-tenant auth + RBAC + audit + demo-mode boundaries** with PostgreSQL/Prisma + refresh rotation + idempotent ledger writes.

✅ Completed in source (`/app/platform/api`) with:
- Org + User creation, password hashing, email verification/reset via encrypted dev outbox.
- JWT access + hashed refresh token rotation with DB session re-checks.
- RBAC guard + tenant scoping derived from DB session (not request-supplied).
- Audit logs for registration, login, status changes, and demo dataset creation.
- Ledger model and demo billing arithmetic (Decimal) + idempotency keys.

✅ POC tests completed (unit-level):
- Token rotation invalidates old tokens.
- RBAC denies, tenant isolation enforced.
- Billing charge calculations and adapter capability boundaries.

⚠️ Integration tests exist but are **skipped here** (DB not available); see §3.

### Phase 2 — V1 App Development (Phase 1 deliverable) ✅ SOURCE IMPLEMENTATION COMPLETE
> Build around proven auth/tenant core. In managed preview, ship Next static export with sample snapshot + disabled mutations.

**Backend (NestJS) — `/app/platform/api`** ✅
1. Scaffold NestJS app modules (auth, portal, admin, audit, demo-mode, carriers, health, OpenAPI).
2. Prisma schema (Postgres) covering Phase 1 + future tables (coherent placeholders):
   - organizations, users, roles/permissions tables (future), refresh_tokens, action_tokens, development_outbox
   - login_history, kyc_requests
   - audit_logs
   - wallets, ledger_entries
   - sip_trunks, sip_credentials, authorized_ips (future)
   - call_sessions/call_events (future) + call_detail_records (used for demo stored CDR)
   - phone_numbers/number_orders/porting_requests (future)
   - upstream_carriers/upstream_credentials/capabilities/routes (future)
   - rate_decks/rate_entries/customer_rate_plans (future)
   - payments/invoices (future)
   - api_keys/webhooks/webhook_deliveries (future)
   - support_tickets/fraud_alerts/system_settings/contact_requests
3. Seed and dev tooling:
   - demo seed script for a customer/admin + demo dataset
   - dev outbox reader CLI
4. REST endpoints (versioned `/api/v1`) + OpenAPI:
   - Auth: register, login, refresh, logout, verify-email, request-reset, reset-password, TOTP setup/enable, me
   - Customer: dashboard summary (KPIs + charts inputs + recent CDR + ledger), CDR query, balance, login history
   - Admin: summary, customers list, customer status update, audit query
   - Carriers: adapter scaffolds/capabilities list (DEMO)
   - Explicit unavailability: calls initiation and trunk writes return capability/phase errors
5. BullMQ/Redis integration:
   - queue producer endpoint for demo dataset job
   - worker consumer source (`api/src/worker.ts`)
   - if Redis missing: explicit 503-style error (no silent fallback)

**Frontend (Next.js) — `/app/platform/web`** ✅
1. Next.js TS app (App Router) + Tailwind + shadcn/ui + next-themes + Lucide + Recharts + React Query + Zustand.
2. Original brand and layout per guidelines:
   - dark navy sidebar, electric-blue accents
   - fonts: **Figtree + Source Code Pro**
   - responsive desktop/mobile and light/dark mode
3. Public marketing + legal draft pages (original content, no BulkVS cloning):
   - Company (home), About, SIP Trunking, Wholesale Voice, Outbound, Inbound, Local DID, Toll-Free,
     Voice API, Pricing, Coverage, Network Infrastructure, Developers, Contact,
     Terms, Privacy, AUP
4. Auth pages (UI complete; connected mode uses API):
   - Register, Login, Verify Email, Reset Password, Forgot Password
5. Customer portal pages:
   - /dashboard overview with KPI tiles, traffic chart, service status, recent calls, exports
   - Calls (CDR) with search/filter/pagination/detail dialog and CSV page export
   - Billing ledger view and exports; funds addition disabled
   - Trunks page shows demo config; create/edit disabled (Phase 2)
   - Numbers/live/webhooks show planned/unavailable with clear phase labels
   - Developers page includes API/setup/architecture/roadmap tabs + source ZIP download
6. Admin portal pages:
   - Overview, Customers, Verification queue view, Carriers, Audit logs
   - In preview, status changes disabled; in connected mode, RBAC enforced via API
7. DEMO MODE boundary:
   - Global banner across portal pages; explicit “no upstream carrier / no real calls/payments”
   - Public site includes DEMO MODE wording

**Managed Preview integration** ✅
- Next static export is served by existing `/app/frontend/craco.config.js` middleware.
- Preview is explicitly **READ-ONLY SNAPSHOT**:
  - `NEXT_PUBLIC_PREVIEW=true`
  - sample dataset is fictional and coherent (409 sample CDRs tied to chart totals)
  - mutations are disabled and never pretend to succeed

**Docs & Ops — `/app/platform/docs`** ✅ (with explicit limitations)
- SETUP.md (Windows + VS Code + compatible Linux contract)
- ARCHITECTURE.md, DATABASE.md, API.md, SECURITY.md, SIP-ACCEPTANCE.md
- STATUS.md and VERIFICATION.md (explicitly distinguishes what is verified here vs blocked)
- DESIGN.md design-system summary

**Deliverables** ✅
- Downloadable source ZIP verified and hosted at:
  - `/downloads/789-network-solutions-source.zip` (actual ZIP, no secrets)

### Phase 3 — Adding More Features (post-Phase-1, NOT started)
1. Expand telecom-core skeleton pages into real CRUD:
   - SIP trunks create/edit/delete
   - IP auth (CIDR allowlist) + SIP credential rotation (no plaintext)
   - caller ID ownership workflows
2. Real-time events (WebSocket) + live calls:
   - simulated demo sessions distinct from production
   - admin call termination controls
3. CDR ingestion pipeline + reconciliation stubs:
   - normalize upstream CDRs, idempotency, auditability
4. Extend carrier adapters:
   - capability matrix, verified integration tests
5. Repeat full testing round:
   - add DB integration tests + concurrency tests

## 3) Next Actions (immediate)

### 3.1 Phase 1 Acceptance (BLOCKED on external runtime)
To mark Phase 1 truly complete (beyond source and preview), run on a compatible machine:
1. PostgreSQL acceptance:
   - apply migrations (`prisma migrate deploy`)
   - execute **integration tests** with `TEST_DATABASE_URL`
   - run full flow: register → outbox verify → login → dashboard persistence → admin review/suspend
   - concurrency/idempotency checks: demo dataset + ledger and CDR idempotency
2. Redis/BullMQ acceptance (optional but required if enabled):
   - verify enqueue + worker completion and retry behavior
3. Operational acceptance:
   - confirm rate-limits, CORS/origin enforcement, cookie security under HTTPS
   - confirm no fallback to preview fixtures in connected mode

### 3.2 Outstanding requested infrastructure deliverables (not created here)
- Dockerfile / Docker Compose, ingress/reverse proxy configs, CI/CD pipelines, deployment automation.
- The project includes a **service contract** and setup guide, but no working orchestration.

### 3.3 Post-acceptance: begin Phase 2 (Telecommunications Core)
- Implement SIP trunk CRUD and SIP edge integration architecture (Kamailio/OpenSIPS + FreeSWITCH + RTPengine)
- Keep production fail-closed and demo clearly labeled.

## 4) Success Criteria

### Source Implementation Milestone ✅ COMPLETE
- `/app/platform` contains requested-stack implementation and forward schema/migrations.
- Managed preview renders polished UI as READ-ONLY SNAPSHOT with honest messaging.
- Carrier-dependent actions are unavailable and explicitly labeled.
- API refuses STAGING/PRODUCTION startup in Phase 1 (fail closed).
- Downloadable source ZIP is present and verified.

### Available-environment Verification ✅ COMPLETE (this environment)
- Prisma validate/generate and migration SQL generation.
- Nest compile and integration-test TypeScript check.
- Next build (42 static pages).
- Automated tests:
  - 145 checks passed (114 behavioral unit + 31 supplemental source checks)
  - 19 PostgreSQL integration tests **skipped** (no DB runtime).
- Browser regression: passed; no remaining UI issues (see `/app/test_reports/iteration_4.json`).

### Full Phase 1 Acceptance (BLOCKED)
- Local mode: API boots with PostgreSQL; web boots; registration → verify → login → dashboard works with persisted data.
- Admin mode: admin lists customers, changes status, views audit logs; unauthorized access blocked.
- Demo boundary: no fake live services; production calling remains disabled without verified carrier.
- Redis/BullMQ: worker jobs verified if enabled.
- Infrastructure deliverables (Docker/Compose/CI/CD/ingress) provided by infrastructure track.

---

## User stories

### Phase 1 (POC)
1. As a user, I can register an organization and user account and receive a verification link in a local dev outbox.
2. As a user, I can log in and receive access + refresh tokens, and refresh rotation blocks reuse of old refresh tokens.
3. As an admin, I can access admin-only endpoints while non-admin users are denied.
4. As a customer, I only see data belonging to my organization even if I guess other IDs.
5. As the system, I record an audit log entry for every login and privileged action.

### Phase 2 (V1 app)
1. As a visitor, I can browse a professional marketing site and understand services without implied live coverage.
2. As a customer, I can log in and view a dashboard with charts and recent CDR/ledger data sourced from storage.
3. As a customer, I can clearly see DEMO MODE and understand which features are unavailable without an upstream carrier.
4. As an admin, I can review customer status and audit events.
5. As a developer, I can view API documentation and example requests for Phase 1 endpoints.

### Phase 3 (future)
1. As a customer, I can create and manage SIP trunks with IP auth or credential auth.
2. As a customer, I can view call sessions and CDRs with filtering/export.
3. As an admin, I can configure upstream carriers through adapters and see capability errors for unsupported ops.
4. As operations, I can monitor live call events over WebSocket in demo and production-separated views.
5. As billing, I can reconcile ledger entries with CDR charges idempotently and prevent double charging.
