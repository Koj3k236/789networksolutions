# 789 NETWORK SOLUTIONS

## Latest additions — A / B / C

SIP trunk management, scoped API keys, and support ticketing with in-app notifications are implemented in source. See [ABC-HANDOFF.md](docs/ABC-HANDOFF.md) for module behavior, API routes, migrations, environment examples and the external administrator handoff. These additions do not activate live SIP or establish production readiness. Database acceptance remains unverified.

## Latest addition — Caller ID permissions

See [Caller ID module documentation](docs/CALLER-ID.md) for the additive migration, customer/admin workflows, authorization policy, API endpoints, and test limitations. External passthrough defaults OFF. Carrier compatibility is enforced separately and outbound calling remains unavailable. The new Caller ID pages show a connection-required state, not fabricated sample records, when no PostgreSQL-backed session is available. Existing unrelated modules were preserved.

## Phase 1 — Requested-stack source foundation

**Not a production telecommunications service. No upstream carrier, SIP edge, live calls, real numbers, payment processor, or real email delivery is connected.**

The main application is **Next.js + TypeScript** and **NestJS + TypeScript**, using **PostgreSQL + Prisma**, with a **Redis/BullMQ** manual background-job worker. It does not use FastAPI or MongoDB. The legacy `/app/frontend` outside this folder only serves the static Next export inside the managed preview and is not needed to run this project locally.

### Start here
- [Windows / VS Code setup and Linux hosting prerequisites](docs/SETUP.md)
- [Architecture and operating states](docs/ARCHITECTURE.md)
- [Database model and module map](docs/DATABASE.md)
- [API reference](docs/API.md)
- [Scope, implementation status and remaining phases](docs/STATUS.md)
- [SIP acceptance checklist](docs/SIP-ACCEPTANCE.md)
- [Security boundaries](docs/SECURITY.md)

### Included
- Original navy/electric-blue brand and light/dark responsive interface.
- Public service pages and draft legal pages; customer/admin portals.
- Persistent registration with business fields, scrypt passwords, JWT access, single-use rotating refresh sessions, local verification/reset outbox, TOTP setup/enable, and login history.
- Server-side tenant authorization and role-protected administration; status changes audited and never enable production calling.
- Tenant-scoped stored demo CDR dashboards, filtered/paginated records, CSV page exports, ledger-derived demo balance, one-time transactional test dataset.
- Prisma PostgreSQL schema and baseline SQL migration for foundation and future telecom modules. UUID identifiers and timestamp-with-time-zone columns.
- Upstream adapter interface, limited mock adapter, explicit capability errors from generic SIP/REST scaffolds.
- Versioned REST + generated OpenAPI. Redis/BullMQ producer and manual-event worker.
- Unit checks and database-gated integration test source.

### Not included / not validated
- No Dockerfile, Compose configuration, ingress, CI/CD, backup jobs, or real deployment was created. Infrastructure configuration is outside this execution environment's allowed scope. A service contract is documented; this remains an outstanding requested deliverable.
- PostgreSQL/Redis/Docker are not available in the managed environment. Database migration execution, complete local account flows, and worker execution require validation on a compatible machine. Never interpret mocked Prisma unit tests as PostgreSQL integration tests.
- Foundation, Caller ID permissions, SIP trunk configuration CRUD, scoped API key management, support conversations and in-app notifications are implemented in source. Real SIP/media, carrier adapters, number provisioning/porting, production billing, signed webhooks, IVR/AMD, reseller workflows and advanced fraud remain later work. Real PostgreSQL acceptance has not been completed.

### Managed preview versus connected application
`NEXT_PUBLIC_PREVIEW=true` compiles a read-only managed preview. The older dashboard contains explicitly fictional records; the newer Caller ID, trunk, API key and support modules instead show connection-required/empty states without fabricated records. `NEXT_PUBLIC_PREVIEW=false` (the local default) requires the real NestJS API: it never silently falls back to sample records if an API fails. No preview data is written to a real tenant.

The source archive intentionally excludes dependencies, build output, environment files, and credentials. Install from `yarn.lock` and configure your own local services.
