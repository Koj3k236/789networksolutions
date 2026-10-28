# Security boundaries and remaining work

## Implemented application controls

- Scrypt with unique salts, constant-time password comparison, no stored plaintext passwords.
- Access JWTs expire in 15 minutes; each request rechecks the active database session, user role, and organization status.
- Refresh tokens are random, hashed at rest, single-use, and rotated transactionally. HttpOnly/SameSite Strict cookies; secure flag required under production hosting.
- Email verification/password reset tokens are hashed, expiring, purpose-bound, single-use. Reset revokes existing sessions.
- AES-256-GCM for configured sensitive tax data, development-outbox links, and TOTP secrets; each uses a random nonce. The key must be protected externally.
- TOTP login replay prevention and conditional atomic update; enrollment secret shown for manual authenticator entry.
- CSRF Origin checks for unsafe cookie-bearing requests, exact-origin CORS, helmet, DTO whitelist, request throttling.
- Customer tenant is derived from database session, never a customer-supplied organization ID. Admin roles enforced by backend decorators.
- Secret-bearing provider configuration is not exposed or accepted by this phase's APIs.
- Production telecom is permanently fail-closed in Phase 1.

## Deliberate limitations — not production security certification

- Throttle storage is in-process, suitable only for a single API instance; replace with shared Redis-backed abuse controls before horizontal scale.
- Do not trust arbitrary forwarded IPs. Trusted proxy handling must be configured against the actual deployment network. Current logs use Express request IP and do not assume ingress headers are safe.
- TOTP recovery codes, disabling, step-up reauthentication, and account recovery are not implemented. Protect your authenticator backup.
- Registration and review are a development workflow, not legally sufficient KYC/KYB. Do not upload sensitive identity evidence; uploads are not implemented.
- Real email delivery, HTTPS termination, operational logs/metrics, backup policies, dependency scanning automation, and secret rotation orchestration need external setup.
- Database row-level security, read-replica/reporting isolation, formal immutable audit storage, production ledger reservations and carrier reconciliation need implementation and independent testing.
- Future Webhook delivery must enforce outbound URL/SSRF restrictions, signing, replay windows, and secret rotation. No webhook is sent today.
- Future SIP auth must implement digest-secret handling appropriate to the actual SIP edge, not reuse web passwords.
- Draft legal policies require qualified review. No FCC/STIR/SHAKEN authority is claimed.

## Before any real customer onboarding

Run all PostgreSQL integration tests, concurrency/race tests, rate-limit/abuse tests, and tenant-isolation regression tests. Review operational access, database privileges, TLS, log redaction, recovery, backups/restore, financial invariants, and actual provider contracts. Do not use a successful build or a read-only demo as evidence of production readiness.
