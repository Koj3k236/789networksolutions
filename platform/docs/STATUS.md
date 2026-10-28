# Implementation status — honest scope boundary

## Phase 1 source implemented

Next.js customer/admin/public interfaces; NestJS APIs; PostgreSQL Prisma schema/baseline SQL; registration and session authentication; local verification/reset outbox; TOTP enrollment and validation; fixed-role authorization; tenant-safe reads; account status review and audit; CDR dashboard/read filtering; transactional idempotent demo dataset; Decimal billing arithmetic and ledger-derived demo balance; carrier capability contract and scaffolds; Redis/BullMQ manual-job source; setup and architecture documentation.

## Tested in this environment

- Prisma schema validation and client generation.
- SQL baseline generation (not database application).
- NestJS TypeScript compilation.
- Next.js TypeScript compilation and 42-page static build.
- Unit-level crypto, access guard, auth token behavior, adapter boundaries, and billing calculations. Supplemental source checks are not end-to-end security proof.
- Browser preview validation reported separately in test reports.

## Requires a compatible runtime to validate

- Applying the migration to PostgreSQL and full registration → local outbox → verification → login → review → dashboard persistence.
- Real concurrent transaction behavior and ledger idempotency against PostgreSQL.
- Redis/BullMQ queue and worker execution/retry behavior.
- Email deliverability is not merely untested: real email is not implemented.

## Outstanding requested infrastructure deliverable

Dockerfile/Compose configuration, reverse-proxy configuration, production deployment, CI/CD and database server administration were not generated or modified. These are outside this execution environment's permitted infrastructure scope. The container service contract is included, but it is not a replacement for working orchestration files. Do not claim this project supports `docker compose up` yet.

## Phase 2 — planned, not implemented

SIP trunk create/edit/delete, IP and credential authentication at SIP edge, live routing/SIP signaling, codec negotiation, OPTIONS diagnostics, CDR ingestion, WebSocket monitoring and simulated/real active call controls remain planned. The separate Caller ID permission/authorization management slice is now implemented in source; see CALLER-ID.md. Its real-database acceptance is still unverified, and it does not implement a SIP edge.

## Phase 3 — planned, not implemented

Actual DID/toll-free search and provisioning, inbound destination configuration, porting documents, invoices, payment-provider integration, rate CSV upload, full billing journal/reservation/reconciliation, taxes, reporting expansions.

## Phase 4 — planned, not implemented

Provider-specific SIP/REST adapter integrations, credential configuration, verified capability tests, health probes, carrier routing and failover, production readiness gates. Generic adapters are intentional stubs, not universal working integrations.

## Phase 5 — planned, not implemented

Voice API key permissions, API usage logs, signed webhooks/retries, IVR/TTS, DTMF, conditional AMD, reseller subaccounts/authorization, advanced fraud/quality analytics, full ticketing and attachments.

## Explicit non-claims

No FCC certification, active nationwide service, direct network ownership, live STIR/SHAKEN signing, emergency calling, real number availability, real carrier balance, guaranteed rates, live payments, successful SIP registration, or production KYC approval is claimed. Legal pages are labeled draft text, not completed legal/compliance work.
