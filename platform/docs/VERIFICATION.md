# Verification record

## A / B / C — current verification

Testing-agent report `iteration_12.json` verified the SIP trunk, API key, support and notification interfaces in their honest disconnected state, including the fixed `/dashboard/sip-trunks/` alias. API/frontend/test TypeScript checks and builds passed. **446 automated checks passed**: 415 behavioral unit/DTO checks with mocked dependencies plus 31 supplemental source checks. **127 PostgreSQL integration tests remain SKIPPED**: trunks 28, API keys 41, support 15, Caller ID 24, original account suite 19. No real database migration, login/persistence workflow, or Redis execution was verified here.

The report's note saying the API-key Generate button was enabled in the disconnected preview is incorrect: a follow-up browser check explicitly returned `is_disabled() == True`. No fake keys, tickets, credentials or approval records are created by the new preview modules. Use `ABC-HANDOFF.md` and the VPS environment examples for the external operator's source handoff; these are not Docker orchestration or a completed deployment.

## Previous Caller ID verification (historical)

## Caller ID slice — latest verification

Testing-agent report `iteration_7.json` confirms successful API/test TypeScript compilation, **222 automated checks passed** (77 new Caller ID behavioral checks plus 145 previous unit/source checks), and browser verification of the new disconnected-state UI. **43 PostgreSQL integration tests were skipped** (24 new, 19 previous). No migrations or real database workflows were executed. Any percentage fields in automated agent reports describing skipped cases as 100% must not be treated as database verification.

Database/test-database credentials were requested securely and skipped. The new pages do not populate fictional records or show fake save success. The existing unrelated demo dashboard remains unchanged. Source and additive migration details: `CALLER-ID.md`. Actual PostgreSQL approval/persistence, concurrency and tenant isolation must still be accepted on a connected instance.

## Previous Phase 1 verification (historical)

## Passed here

- Prisma schema validation and Prisma client generation.
- Initial PostgreSQL migration SQL generation (not database execution).
- NestJS TypeScript compilation and separate integration-test TypeScript checking.
- Next.js build: 42 static pages/routes generated with no compiler errors.
- 145 automated checks: 114 behavioral unit tests against mocked dependencies and 31 supplemental source-structure assertions. These are not PostgreSQL end-to-end tests.
- Browser regression: customer dashboard, consistent 409-record sample/traffic totals, range tabs, CDR search/status/pagination/detail, CSV controls, billing, unavailable modules, admin search/review/audit, carrier scaffolds, auth layouts, developer docs/source ZIP, public pages, light/dark switching, desktop and mobile navigation.
- Reported public banner wording issue fixed and rechecked: explicit DEMO MODE/read-only labels are present.
- Integration-suite source defects identified during review were corrected and statically checked: tracked cleanup, real session-issued admin JWTs, isolated throttle tests, valid review reasons/response codes, nonempty tenant-isolation fixture.

## Not executed

**19 PostgreSQL integration tests are skipped** because no PostgreSQL test runtime is available. Migration application, connected account/email-verification/reset/review flows, real transaction concurrency, and PostgreSQL-backed persistence still require a compatible runtime. The test suite now has valid source/typechecking; it has not been proven to pass against a database.

Redis/BullMQ connectivity, worker execution and retries have not been exercised. No real SMTP, payment, upstream, SIP, or media integration exists in Phase 1.

## Important distinction

Session storage in the actual API is PostgreSQL-only. There is **no in-memory session/database fallback**. The Nest request throttle currently uses process-local storage; this must become shared before horizontal scaling. The Next managed preview intentionally uses explicitly labeled read-only sample data and disables API writes. This is not a production service.

## Infrastructure still outstanding

Docker/Compose files, deployment/reverse-proxy configuration, CI/CD, operational backups and live monitoring were not implemented. See SETUP.md for the service contract and compatible-runtime prerequisites.
