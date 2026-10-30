# A / B / C application-source handoff

Target requested by the owner: `789networksolutions.com`, VPS `201.79.46.149`, suggested SSH port `22`.

**This is an application-source handoff, not a completed deployment or a production-readiness certificate.** No SSH connection, host inspection, OS/service changes, PostgreSQL/Redis provisioning, TLS setup, DNS change, or remote deployment has been performed. Port 22 is the standard default but has not been verified on this server. Real database integration tests require operator-supplied test PostgreSQL access and have not passed here because they were skipped.

Docker/Compose, Nginx/TLS configuration and server administration remain outside this execution scope and are **not included**. The service contract in SETUP.md is not a working orchestration package. An authorized administrator must supply and verify that infrastructure without disrupting existing services.

## Implemented source modules

### A — SIP trunk management

- Customer and authorized administrator create/read/update/delete trunk configurations using NestJS + Prisma.
- Customer: `/dashboard/trunks/`; alias `/dashboard/sip-trunks/`; admin: `/admin/trunks/?customer=UUID`.
- Configuration fields: name, description, hostname/realm, transport UDP/TCP/TLS, authentication mode, concurrency/CPS limits, authorized default Caller ID and optional failover SIP URI.
- New configurations are disabled. Enabling is only a configuration flag, never proof of connectivity. IP mode requires an allowed source network; credential mode requires generated credentials. No SIP listener, routing engine admission control or actual calls are enabled.
- Server-generated 256-bit password, unique username, SHA-256 SIP HA1, encrypted HA1 at rest. The password is returned once on create/rotation and never returned by subsequent reads. The future SIP edge must explicitly support this digest algorithm; legacy adapter interoperability is not assumed.
- Changing the authentication mode or realm replaces credentials and disables configuration. Rotation invalidates the prior password. No digest or plaintext is written to audit metadata.
- Public IPv4/IPv6 and CIDR canonicalization; private/reserved/overlapping ranges blocked. IPv4 prefixes shorter than /8 and IPv6 shorter than /32 are refused. A trunk may have at most 100 networks.
- Account defaults: 20 concurrent calls, 2 CPS as configuration caps. Trunk values must remain within those caps. Super Admin/Operations Admin can change caps but cannot reduce them below existing trunk settings. This is configuration enforcement; concurrent live call admission is not implemented.
- Caller ID is checked through the existing shared authorization policy. Deleted trunks cannot be selected by Caller ID APIs. Caller ID/default changes increment trunk revision to avoid stale overwrites.
- Delete is an audited soft delete preserving historic CDRs. Credentials and IP allowlists are removed. Attached unreleased numbers must first be reassigned/released. Archived names remain reserved by the tenant uniqueness constraint.
- Admin writes: Super Admin or Operations Admin. Other authorized administration roles may inspect configurations. Customer writes remain tenant-scoped.

### B — API key management

- `/dashboard/api-keys/` provides create, scope selection, rotation, revocation and latest usage logs.
- 256-bit keys, SHA-256 hashes at rest, secret disclosed once, prefix-only listings. Default expiry 90 days; selectable 1–365 days. At most 25 active keys per owner.
- Keys belong to the creating user and organization. Revocation and rotation use a tenant row lock; rotation revokes the old key and preserves scopes/expiry. Expired/revoked keys cannot be rotated.
- Keys recheck owner existence, matching tenant, expiry, revocation and account restrictions on each request. Current in-flight requests are not retroactively cancelled by revocation.
- Explicit `X-API-Key` authentication applies only to `/api/v1/automation/*` with a required per-route scope. Management, administration, key issuance, and real call initiation do not accept these API keys.
- Scopes: `trunks:read`, `trunks:write`, `cdr:read`, `balance:read`, `caller-id:read`.
- `trunks:write` permits configuration creation/update and can receive newly generated SIP credentials when relevant. Give that scope only to trusted backend systems.
- Usage records contain key prefix, route pattern, method, HTTP status, timestamp and request ID. No raw key, body, query string or credential is recorded. Known invalid/expired keys and scope denials are logged; unknown keys and global abuse-throttle denials cannot be associated with an owner.
- API-key request throttle currently inherits the application process-local limiter. Shared distributed abuse controls remain a scaling prerequisite.

### C — Support ticketing

- Customer `/dashboard/support/`, administrator `/admin/support/`, notifications `/dashboard/notifications/`.
- Persistent subjects, descriptions, categories, priorities, thread replies and revisions. Customer queries are organization-scoped.
- Customers create/reply, close tickets, or reopen resolved/closed tickets. Closed tickets reject new replies until reopened. Replies are append-only; no deletion or editing of prior messages is exposed.
- Super Admin/Operations Admin/Support Agent may manage the queue, reply, change status/priority, and assign an active authorized support owner.
- Status: OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED. Priorities: LOW, NORMAL, HIGH, URGENT. No response-time SLA is implied by a priority label.
- Assignment and state changes are audited. Ticket row locks and expected revisions prevent lost concurrent edits.
- Ticket/reply/status events persist in-app notifications in the same transaction. Notifications are recipient- and organization-scoped. Customers can read or mark their own notifications; support staff receive assignments and customer updates. If an assignee loses access, the active support pool is notified instead.
- **No email, SMS, file attachment or push-notification delivery is implemented or claimed.** Notifications are real database records when connected, not outbound messages.

## API routes

All prefixes below are relative to `/api/v1` and require JWT unless listed as scoped automation.

### Trunks

```text
GET    /sip-trunks/workspace
GET    /sip-trunks
POST   /sip-trunks
GET    /sip-trunks/:id
PATCH  /sip-trunks/:id
PATCH  /sip-trunks/:id/enabled
POST   /sip-trunks/:id/credentials/rotate
POST   /sip-trunks/:id/ips
DELETE /sip-trunks/:id/ips/:ipId
DELETE /sip-trunks/:id
```

Admin equivalents are under `/admin/customers/:orgId/sip-trunks`; account caps use `PATCH .../account-limits`. All revisioned mutations require `expectedVersion` from the latest stored record.

### Keys and automation

```text
GET/POST /api-keys
GET      /api-keys/usage
POST     /api-keys/:id/rotate
DELETE   /api-keys/:id

GET/POST /automation/sip-trunks           X-API-Key + read/write scope
PATCH    /automation/sip-trunks/:id       X-API-Key + write scope
GET      /automation/cdr                 X-API-Key + cdr:read
GET      /automation/balance             X-API-Key + balance:read
GET      /automation/caller-id           X-API-Key + caller-id:read
```

The balance endpoint still reports the explicit DEMO/internal test ledger; it is not a real-money balance or payment confirmation.

### Support

```text
GET/POST /support/tickets
GET      /support/tickets/:id
POST     /support/tickets/:id/replies
PATCH    /support/tickets/:id/status
GET      /admin/support/agents
GET      /admin/support/tickets
GET      /admin/support/tickets/:id
POST     /admin/support/tickets/:id/replies
PATCH    /admin/support/tickets/:id
GET      /notifications
POST     /notifications/read-all
PATCH    /notifications/:id/read
```

## Database changes

Apply existing migrations plus these additive migrations, in order:

1. `20261101000000_trunk_management`
2. `20261101010000_api_keys`
3. `20261101020000_support_ticketing`

Tables include new `api_usage_logs`, `support_ticket_replies`, and `notifications`; existing trunk/key/ticket tables are extended. Inspect the migration on a disposable database before applying anywhere valuable. Review legacy `support_tickets.assignedTo` values before adding its new foreign key. No database reset is requested.

## Operator prerequisites and safe sequence

1. The authorized administrator inventories the VPS and existing ports/services before making any changes. Use a dedicated non-root access account, temporary operator-generated public-key authorization, restricted source IP, and revoke access afterward. A Docker group or unrestricted sudo is root-equivalent, not restricted access.
2. Confirm ownership/DNS for the domain and obtain an isolated application service/network/database plan without replacing existing virtual hosts or occupied services. These tasks have not been performed here.
3. Provision real PostgreSQL and Redis through your approved infrastructure process. Keep database/Redis ports private. Supply application and a **separate disposable test database** using your secrets manager, not chat.
4. Install application dependencies from the included lockfile, generate Prisma client, apply migrations to the test database, and run the real integration suite. Only proceed if it passes.
5. Build the API and Next frontend with `NEXT_PUBLIC_PREVIEW=false`. The managed preview flag must not be enabled in your actual account-management deployment.
6. `APP_MODE=DEMO` remains the existing telecom/test-ledger safety gate. It does **not** disable the new account-management APIs. `NODE_ENV=production` and secure cookies are hosting settings; neither authorizes calls. The application still refuses telecom STAGING/PRODUCTION startup.
7. Complete TLS/reverse-proxy/process supervision/logging/backups through your external operator. No ready-to-run Docker/Nginx/SSL configuration is bundled by this task.
8. Perform actual login → create trunk → logout/login → read stored trunk → IP/credential rotation → API-key request/rotation/revocation → support reply/notification workflows in a connected browser. Check cross-tenant denials and absence of secrets in logs. Do not label services Operational based only on a successful build or static preview.

### Read-only inventory commands for an authorized operator

These are diagnostic examples, not commands executed by this agent. Replace the username with the already authorized restricted account; do not create an access account or grant root privileges merely to run these commands.

```sh
ssh -p 22 DEPLOY_USER@201.79.46.149
uname -a
cat /etc/os-release
free -h
df -h
ss -lnt
systemctl --type=service --state=running --no-pager
```

### Application commands on the operator's compatible environment

Run from the extracted `platform` folder after the operator supplies the appropriate environment:

```sh
yarn install --frozen-lockfile
yarn prisma generate
yarn prisma validate
# First on the isolated test database, never an unreviewed production database:
yarn prisma migrate deploy
yarn tsc -p api/tsconfig.json
yarn vitest run
# Build with web environment configured to the actual API and preview disabled:
yarn next build web
```

Compiled API entry: `api/dist/main.js`; worker entry: `api/dist/worker.js`; web export: `web/out`. The operator's process manager should supervise these according to the service contract. Do not expose a working SIP endpoint until an actual edge/carrier integration has been independently tested.

## Current validation boundary

Unit and disconnected-state UI testing are not real PostgreSQL integration validation. The supplied integration suites are gated by `TEST_DATABASE_URL`; skipped cases remain unverified. Redis/BullMQ worker execution, external hosting, TLS, monitoring, and real connected browser acceptance remain outstanding. See VERIFICATION.md for the latest actual counts.
