# System architecture

## Implemented control-plane foundation

```text
Next.js TypeScript portal (React Query / Zustand / shadcn / Recharts)
    │ HTTPS REST, access JWT; HttpOnly rotating refresh cookie
    ▼
NestJS /api/v1
    ├── Auth / access guard / fixed-role authorization
    ├── Customer dashboard / stored demo CDRs / ledger read model
    ├── Admin customer review / audit
    ├── Manual demo dataset producer
    └── UpstreamCarrierAdapter capability boundary
          ├── Mock: labeled balance / rates / number examples
          ├── Generic SIP: explicit unavailable scaffold
          └── Generic REST: explicit unavailable scaffold
    │ Prisma, UUIDs, Decimal, parameterized SQL
    ▼
PostgreSQL ───────── Redis / BullMQ ─────── manual-event worker
```

No FastAPI/MongoDB application logic is used. The Next export is portable; the managed preview only serves it using an existing static middleware. The default local app requires the Nest API and never uses sample fixtures on API errors.

## Future telecommunications plane (not operational)

```text
Authorized customer SIP trunk
  -> Kamailio or OpenSIPS edge (SIP UDP/TCP/TLS)
  -> policy/routing decision service
  -> verified carrier adapter + allowed destination route
  -> upstream network

Where required: RTPengine media anchoring, FreeSWITCH IVR/media handling
  -> authenticated call events/CDR ingestion
  -> idempotent billing and reconciliation
```

The web application is not a SIP server. There are no running SIP listeners, OPTIONS probes, transactions, DTMF processing, or STIR/SHAKEN signers in Phase 1. Generic adapters do not make network requests or pretend successful registrations.

## Operating states

- **DEMO:** the only allowed Phase 1 server mode. Stored test records have `mode=DEMO`, demo accounts cannot enable production. Mock data is labeled. Real operations return unavailable.
- **STAGING:** modeled in schema, not implemented. Future infrastructure tests must be allowlisted and sandbox-only.
- **PRODUCTION:** modeled but refused by application startup. Future activation requires verified carrier connectivity/capabilities, customer KYC/KYB, caller ID authorization, billing funding/reservations, routing quality/compliance, and monitoring. All checks fail closed.

`NODE_ENV=production` is a Node hosting optimization/security setting, not telecom activation. `APP_MODE` controls telecom state and must remain DEMO.

## Module boundaries

- `api/src/auth`: validated account DTOs, registration, verification/reset, access/refresh, TOTP.
- `api/src/common`: Prisma lifecycle, encryption/hashing, global access/RBAC guard.
- `api/src/portal`: tenant dashboard/CDR queries and restricted customer administration.
- `api/src/demo`: transactional test dataset and queue producer. This is a sample fixture loader, not a call origination engine.
- `api/src/carriers`: adapter contract and explicit capability errors. No arbitrary URL/credential execution.
- `api/src/worker.ts`: manual job consumer, independent of HTTP server.
- `web/app`: Next App Router, statically enumerated public/customer/admin routes.
- `web/components`: shell, portal charts/tables, account forms, admin, marketing, modules.
- `web/lib`: typed data, API/session store, explicitly compiled preview fixtures, public content.
- `prisma`: full proposed schema, baseline SQL, local demo seed and outbox reader.

## Financial foundation

Wallet balance is derived from signed immutable-by-API ledger entries rather than a mutable balance column. Demo charges use Prisma Decimal with six decimal places, explicit increments, and minimum/connection-charge calculation. Dataset writes are one PostgreSQL transaction, protected by an advisory lock and unique keys. There are no endpoints for updating or deleting ledger entries. Production debit reservations, hard database-level immutability permissions, tax accounting, refunds, payments, and carrier reconciliation are not claimed implemented.

## Tenant boundary

The backend derives the principal organization from the active database session, not a request-supplied tenant ID. Customer data queries always scope by this organization. Composite foreign keys prevent several important cross-tenant trunk/call associations. Administration endpoints are protected separately. Database row-level security and a fully enforced reseller hierarchy remain future defense-in-depth work; schema presence alone does not provide these workflows.

## Upstream contract

Every adapter declares capabilities and methods: `testConnection`, `getBalance`, `getRates`, `getAvailableNumbers`, `provisionNumber`, `releaseNumber`, `originateCall`, `terminateCall`, `getCallStatus`, `normalizeCDR`, `verifyCallerIdSupport`. In this phase mock calls/provisioning are intentionally unsupported. Test dataset creation is separate and explicitly simulated. Generic adapters must be replaced/extended with provider-specific, contract-tested code before capabilities are enabled.
