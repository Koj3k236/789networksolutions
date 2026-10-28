# Caller ID Permission Management

## Scope and runtime status

This additive module implements caller-identity management in the existing Next.js/NestJS/PostgreSQL source. It does not activate a SIP edge, carrier, inbound/outbound calls, payment provider, or other unrelated modules.

**PostgreSQL connection access was not supplied.** The migration and real-database workflows have not been executed in this environment. The new preview pages show a truthful connection-required state rather than fictional customer settings, requests, numbers, or successful saves. They do not reuse the older dashboard's mocked records.

- Customer: `/dashboard/caller-ids/`
- Admin: Customer Management → customer details → **Caller ID permissions**, or `/admin/caller-id-permissions/?customer=UUID`
- Backend prefix: `/api/v1`

## Database defaults

Every organization gets these defaults directly from PostgreSQL column definitions, including future registrations without changes to registration code:

| Setting | Default |
|---|---|
| External Caller ID Passthrough | OFF |
| Allow Per-Call Caller ID Selection | OFF |
| Require Additional Caller ID Review | ON |
| Permission status | DISABLED |
| Notes / last administrative modification | Unset |

The additive migration is `prisma/migrations/20261029000000_caller_id_permissions/migration.sql`. It adds Organization permission fields, `caller_id_permission_requests`, review metadata, optimistic revision numbers, an enabled-requires-approval check, and a partial unique index allowing only one pending request per tenant. Existing Caller ID rows remain PENDING under the new policy; an old `verified` boolean alone never grants authorization.

Apply it only on your configured PostgreSQL instance after inspecting the migration:

```text
yarn prisma generate
yarn prisma migrate deploy
yarn tsc -p api/tsconfig.json
```

No database reset, balance change, fabricated customer, or fake production call is included.

## Role matrix

| Actor | Read own inventory/request | Submit request/number/default | Read customer permissions | Change policy/review ownership |
|---|---|---|---|---|
| Customer / reseller account | Yes | Own tenant only | Own tenant only | No |
| Operations, Billing, Support admin | Yes | Own tenant only | Yes | No |
| Super Admin / Compliance Admin | Yes | Own tenant only | Yes | Yes |

The existing global access guard still checks active sessions, role and suspension. The new service also enforces editor roles, derives customer tenant from the principal, and scopes identifiers to the selected tenant. No customer can submit a user ID or organization ID to grant themselves access.

## Workflows

### Request permission

A customer submits a business justification. Only one pending request is allowed. Customers may withdraw pending requests. Admin approval turns on the customer permission but **does not authorize any number** and never grants carrier compatibility. Admin rejection records notes and leaves passthrough off. Direct settings changes are blocked while a pending request awaits review.

### Register and review a number

Customers submit an E.164 external number and authorization description. This creates a PENDING record only. Staff separately reviews an offline ownership/authorization document and records its evidence reference plus review notes. Authorization requires explicit ownership confirmation; additional review must also be confirmed when enabled in customer policy. This is a documented manual-review workflow, not an automated phone/SMS challenge or uploaded-document verification system.

Staff may authorize, reject, or revoke. Customers may withdraw their own identities. Reviews and withdrawals preserve history. An expired authorization cannot be selected or pass validation. Approval does not claim STIR/SHAKEN attestation or FCC certification.

Assigned identities come only from the tenant's ACTIVE production-mode inventory. Demo number inventory is never treated as real ownership.

### Trunk defaults

The customer selects only from policy-authorized identities. The shared organization policy applies to every trunk. Revoking a number, disabling permission, or requiring an unmet additional review clears affected trunk defaults in the same transaction, with a separate audit event for each changed trunk. Customer configuration can be saved while upstream activation is pending; it is never presented as a registered SIP connection.

### Before routing

`evaluateCallerIdPolicy()` independently returns:
- `customerPermissionAllowed`: permission, number authorization/evidence, expiry, account eligibility and per-call checks.
- `carrierPolicyAllowed`: enabled/verified carrier, recent recorded health, verified external-caller-ID capability and explicit `VERIFIED_EXTERNAL` policy when applicable.
- `routingAllowed`: **always false in this implementation**.

`resolveSignaledIdentity()` is a helper for a future trusted SIP-edge adapter accepting already-parsed E.164 From/asserted identities. Conflicting identities are rejected. This does not implement SIP listeners or process live P-Asserted-Identity headers. The existing call endpoint stays unavailable. The diagnostic API cannot place a call or override routing gates.

Carrier flags are loaded server-side, never accepted as trusted client JSON. A successful customer permission check never defeats an upstream policy denial. Health timestamps are data inputs, not newly implemented health probes.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/caller-id/workspace` | Own settings, inventory, requests, trunk defaults and audit |
| POST | `/caller-id/requests` | Submit enablement justification |
| DELETE | `/caller-id/requests/:id` | Withdraw own pending request |
| POST | `/caller-id/inventory` | Submit number/authorization description |
| DELETE | `/caller-id/inventory/:id` | Withdraw identity without deleting history |
| PATCH | `/caller-id/trunks/:id/default` | Save authorized default or null |
| POST | `/caller-id/validate` | Audited diagnostic, never call initiation |
| GET | `/admin/caller-id/requests` | Latest 100 requests across customers |
| GET | `/admin/caller-id/customers/:orgId` | Customer management workspace |
| PATCH | `/admin/caller-id/customers/:orgId/permissions` | Version-checked permission update |
| POST | `/admin/caller-id/customers/:orgId/requests/:id/decision` | Approve/reject pending request |
| POST | `/admin/caller-id/customers/:orgId/inventory/:id/review` | Authorize/reject/revoke number |

Example settings update (requires editor JWT; applicable browser Origin checks still apply):

```json
{
  "externalCallerIdPassthroughEnabled": true,
  "allowPerCallCallerIdSelection": false,
  "requireAdditionalCallerIdReview": true,
  "status": "APPROVED",
  "notes": "Customer use case reviewed; each number requires documented authorization.",
  "expectedVersion": 2
}
```

Use the current version from the workspace. Stale decisions return 409 instead of overwriting concurrent changes. IDs are UUID-validated. Notes/justifications require meaningful lengths, unknown DTO fields are rejected, and all mutation operations write audit entries in the same PostgreSQL transaction. A tenant row lock serializes permission, review and trunk-default changes.

## Verification and limitations

Testing-agent reports cover the new unit policy/service/DTO tests with MOCKED Prisma dependencies and the disconnected-state browser UI. Real database acceptance tests are gated on `TEST_DATABASE_URL`; skipped tests are **not passes** and do not establish real tenant isolation or transactional persistence.

Integration tests use fresh test tenants and guarded ID-scoped cleanup, require a database pathname containing `test`, and must never target customer data. Synthetic production-mode assigned-number fixtures exist only inside that isolated test suite; organization calling remains disabled. Apply both Prisma migrations before running those cases.

The broader live-platform/Docker request remains separate outstanding work. This slice deliberately preserves unrelated existing modules and does not convert the legacy mocked dashboard into a live database dashboard.
