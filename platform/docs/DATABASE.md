# PostgreSQL schema and module map

Source: `prisma/schema.prisma`. Baseline: `prisma/migrations/20260501000000_foundation/migration.sql`.

All business identifiers use UUIDs. Financial amounts use `Decimal(18,6)`. Operational timestamps use `timestamptz(3)`. Foreign keys and composite unique/index constraints are included. Applying and validating the migration against PostgreSQL is still required.

## Active foundation tables

| Tables | Purpose |
|---|---|
| organizations, users | Business registration, tenant membership, account status, fixed role |
| refresh_tokens | Hashed refresh sessions, single-use rotation, revocation |
| action_tokens | Hashed expiring verification/reset links |
| development_outbox | Encrypted local-only verification/reset messages; no email service |
| login_history | IP/user-agent and successful/failed password login history |
| kyc_requests | Development review status/reason; no real document approval |
| audit_logs | Registration, verification, login, status changes, test dataset events |
| wallets, ledger_entries | Demo signed ledger entries and derived wallet balance |
| call_detail_records, sip_trunks | Stored demo fixture data, inactive configuration examples |
| contact_requests | Persistent public inquiries in connected mode |

## Forward schema, workflows not implemented

- roles, permissions, role_permissions: future configurable permissions. Current enforcement uses the `Role` enum and decorators, not editable permission rows.
- sip_credentials, authorized_ips: future SIP credential/IP-auth flows.
- caller_ids, caller_id_verifications: ownership/authorization evidence and verification history.
- phone_numbers, number_orders, porting_requests: inventory lifecycle and future carrier provisioning/porting.
- upstream_carriers, upstream_credentials, carrier_capabilities, carrier_routes: encrypted future provider configuration and capability proof.
- rate_decks, rate_entries, customer_rate_plans: effective rate deck and destination-prefix pricing model.
- call_sessions, call_events: future live session/event ingestion.
- payments, invoices: future verified financial provider workflows.
- api_keys, webhooks, webhook_deliveries: future programmatic access and signed outbound delivery.
- support_tickets, fraud_alerts: future support and fraud workflows.
- system_settings: future managed configuration.
- organizations.parentId: future reseller hierarchy; do not infer implemented reseller authorization from the field alone.

## Important constraints

- `users.email` is unique and normalized at account creation/login.
- `wallets(organizationId, mode, currency)` uniquely separates demo/staging/production balances.
- `ledger_entries.idempotencyKey` and `call_detail_records.idempotencyKey` prevent duplicated event effects.
- SIP trunk names are unique within an organization.
- Trunk/call relations include tenant ID in composite references where needed.
- Customer query indexes cover tenant + mode + time for CDRs and tenant + status for inventory/reviews.
- Revoked refresh tokens cannot be reused by the access guard or refresh endpoint.

## Additional production work

Add carrier event uniqueness/reconciliation identifiers, debit reservations, formal double-entry journal accounting if required by finance, verified tax models, application DB least-privilege roles, immutable ledger/audit DB policies, retention and backup procedures, row-level security evaluation, and reseller-specific constraints. These require real domain acceptance testing; this schema is a foundation, not certification that every future workflow is complete.
