# API v1

The NestJS server exposes `/api/v1/*`. OpenAPI UI: `/api/docs`; JSON: `/api/openapi.json`. The managed read-only preview does not run this API; do not test the unrelated legacy FastAPI template as if it were NestJS.

## Implemented endpoints

| Method | Path (relative to /api/v1) | Authorization / behavior |
|---|---|---|
| GET | /health | Public, DEMO-only application metadata |
| POST | /auth/register | Public rate-limited business account registration |
| POST | /auth/login | Public rate-limited password/TOTP sign-in |
| POST | /auth/refresh | Single-use HttpOnly refresh cookie, valid browser Origin required |
| POST | /auth/logout | Revokes refresh session and clears cookie |
| POST | /auth/verify-email | Consumes local outbox verification link |
| POST | /auth/request-reset | Generic response; local outbox delivery only |
| POST | /auth/reset-password | Single-use token, revokes sessions |
| GET | /auth/me | Authenticated principal |
| POST | /auth/totp/setup | Authenticated, returns enrollment secret once per setup |
| POST | /auth/totp/enable | Authenticated, confirms six-digit code |
| GET | /dashboard?days=1 | Tenant dashboard; range 1, 7, or 30 |
| GET | /cdr?page=1&status=COMPLETED&search=202 | Tenant-scoped records, 25/page |
| GET | /balance | USD DEMO ledger balance |
| GET | /sip-trunks | Read-only tenant trunk configurations; no stored passwords |
| GET | /numbers | Tenant's stored number records; empty unless explicitly populated |
| POST | /numbers/search | Explicit mock example inventory only |
| GET | /rates | Explicit illustrative mock rate only |
| GET | /login-history | Current user's latest login history |
| POST | /demo/dataset | Persist one transactional simulated dataset, idempotent per tenant |
| POST | /demo/jobs | Enqueue dataset; requires configured Redis/worker |
| POST | /contact | Public rate-limited inquiry persistence, no email sent |
| GET | /admin/summary | All administration roles |
| GET | /admin/customers | All administration roles, latest 100 organizations |
| PATCH | /admin/customers/{uuid}/status | Super/Compliance admin; reason required; never enables production |
| GET | /admin/audit | All administration roles, latest 100 audit events |
| GET | /admin/carriers | Super/Operations/Compliance admin; capability scaffolds only |

## Deliberately unavailable

`POST /calls` returns 501 `CAPABILITY_UNAVAILABLE`; `POST /sip-trunks` returns 501 `PHASE_NOT_IMPLEMENTED`. No transaction, carrier request, or live call is created. Call status/hangup, trunk writes, number provisioning, API key CRUD, signed webhooks, and payment APIs are not implemented in Phase 1 and must not be advertised as working.

## Example login

```http
POST /api/v1/auth/login
Content-Type: application/json
Origin: http://localhost:3000

{"email":"owner@example.com","password":"YOUR_LOCAL_PASSWORD","code":"OPTIONAL_TOTP_CODE"}
```

Omit `code` if TOTP is not enabled. A successful response contains an access JWT and non-sensitive user fields. The refresh token is an HttpOnly cookie, not a JSON field. Never hardcode access tokens into frontend source.

## Example balance

```http
GET /api/v1/balance
Authorization: Bearer YOUR_ACCESS_TOKEN
```

```json
{"balance":"0.000000","currency":"USD","mode":"DEMO","realFunds":false}
```

## Example account review

```http
PATCH /api/v1/admin/customers/ORGANIZATION_UUID/status
Authorization: Bearer ADMIN_ACCESS_TOKEN
Content-Type: application/json
Origin: http://localhost:3000

{"status":"UNDER_REVIEW","reason":"Business details require further review"}
```

Unknown roles cannot perform this operation. Administrators cannot change their own or another administrative organization using this workflow. Rejected/suspended organizations lose sessions; approved demo accounts still cannot call.

## Errors and session handling

- 400 invalid inputs; unknown DTO fields are rejected.
- 401 missing/expired/revoked session; frontend attempts one coordinated refresh.
- 403 role/status/origin restrictions.
- 409 duplicate email.
- 429 abuse throttle.
- 501 unimplemented call/trunk capability.
- 503 Redis absent for queue operations.
- Unexpected database errors never trigger sample fallback.

All unsafe requests carrying the refresh cookie must send the configured Origin. Client-only CSV exports include a DEMO marker and neutralize spreadsheet formula prefixes. CDR export covers the loaded page, not every record in the database.
