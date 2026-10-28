-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('DEMO', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'RESELLER', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'BILLING_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_AGENT');

-- CreateEnum
CREATE TYPE "NumberStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'RELEASED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "businessName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "website" TEXT,
    "registrationNumber" TEXT,
    "taxIdEncrypted" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "productionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "parentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "totpEncrypted" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpLastStep" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" "Role" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_outbox" (
    "id" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "successful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_requests" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "reviewerId" UUID,
    "notes" TEXT,
    "documentObjectKeys" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),

    CONSTRAINT "kyc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sip_trunks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "authType" TEXT NOT NULL DEFAULT 'IP',
    "domain" TEXT NOT NULL DEFAULT 'sip.example.com',
    "transport" TEXT NOT NULL DEFAULT 'TLS',
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "cps" INTEGER NOT NULL DEFAULT 1,
    "callerIdPolicy" TEXT NOT NULL DEFAULT 'VERIFIED_ONLY',
    "defaultCallerId" TEXT,
    "failoverUri" TEXT,

    CONSTRAINT "sip_trunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sip_credentials" (
    "id" UUID NOT NULL,
    "trunkId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "digestEncrypted" TEXT NOT NULL,
    "rotatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sip_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorized_ips" (
    "id" UUID NOT NULL,
    "trunkId" UUID NOT NULL,
    "cidr" TEXT NOT NULL,

    CONSTRAINT "authorized_ips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caller_ids" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "authorizationRef" TEXT,
    "stirStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "caller_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caller_id_verifications" (
    "id" UUID NOT NULL,
    "callerIdId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "evidenceObjectKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caller_id_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "number" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "kind" TEXT NOT NULL DEFAULT 'LOCAL',
    "status" "NumberStatus" NOT NULL DEFAULT 'AVAILABLE',
    "state" TEXT,
    "city" TEXT,
    "monthlyCharge" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "trunkId" UUID,
    "inboundUri" TEXT,
    "backupUri" TEXT,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_orders" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "numberId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "number_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "porting_requests" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "numbers" TEXT[],
    "losingCarrier" TEXT NOT NULL,
    "authorizationObjectKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "focAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "porting_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upstream_carriers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sipHost" TEXT,
    "sipPort" INTEGER NOT NULL DEFAULT 5061,
    "transport" TEXT NOT NULL DEFAULT 'TLS',
    "apiBaseUrl" TEXT,
    "supportedDestinations" TEXT[],
    "codecs" TEXT[],
    "callerIdPolicies" TEXT[],
    "concurrentLimit" INTEGER NOT NULL DEFAULT 0,
    "cpsLimit" INTEGER NOT NULL DEFAULT 0,
    "lastHealthAt" TIMESTAMPTZ(3),

    CONSTRAINT "upstream_carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upstream_credentials" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "rotatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upstream_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_capabilities" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,

    CONSTRAINT "carrier_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_routes" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',

    CONSTRAINT "carrier_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_decks" (
    "id" UUID NOT NULL,
    "carrierId" UUID,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_entries" (
    "id" UUID NOT NULL,
    "rateDeckId" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "perMinute" DECIMAL(18,6) NOT NULL,
    "connectionFee" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "minimumCharge" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "incrementSeconds" INTEGER NOT NULL DEFAULT 6,
    "minimumSeconds" INTEGER NOT NULL DEFAULT 6,

    CONSTRAINT "rate_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_rate_plans" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "rateDeckId" UUID NOT NULL,
    "markupPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,

    CONSTRAINT "customer_rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "trunkId" UUID,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_events" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_detail_records" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "callId" UUID,
    "trunkId" UUID,
    "carrierId" UUID,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "answerTime" TIMESTAMPTZ(3),
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "billableDuration" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "sipCode" INTEGER NOT NULL,
    "upstreamCost" DECIMAL(18,6) NOT NULL,
    "customerRate" DECIMAL(18,6) NOT NULL,
    "customerCharge" DECIMAL(18,6) NOT NULL,
    "grossMargin" DECIMAL(18,6) NOT NULL,
    "disconnectReason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reconciledAt" TIMESTAMPTZ(3),

    CONSTRAINT "call_detail_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "creditLimit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lowBalanceThreshold" DECIMAL(18,6) NOT NULL DEFAULT 25,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "providerRef" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "subtotal" DECIMAL(18,6) NOT NULL,
    "tax" DECIMAL(18,6) NOT NULL,
    "total" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'DEMO',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "revokedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "webhookId" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "statusCode" INTEGER,
    "payload" JSONB NOT NULL,
    "nextAttemptAt" TIMESTAMPTZ(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" UUID,
    "attachmentObjectKeys" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_alerts" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "contact_requests" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_status_createdAt_idx" ON "organizations"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_hash_key" ON "refresh_tokens"("hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "action_tokens_hash_key" ON "action_tokens"("hash");

-- CreateIndex
CREATE INDEX "action_tokens_userId_purpose_idx" ON "action_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "login_history_userId_createdAt_idx" ON "login_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "kyc_requests_organizationId_status_idx" ON "kyc_requests"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sip_trunks_id_organizationId_key" ON "sip_trunks"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sip_trunks_organizationId_name_key" ON "sip_trunks"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sip_credentials_trunkId_key" ON "sip_credentials"("trunkId");

-- CreateIndex
CREATE UNIQUE INDEX "sip_credentials_username_key" ON "sip_credentials"("username");

-- CreateIndex
CREATE UNIQUE INDEX "authorized_ips_trunkId_cidr_key" ON "authorized_ips"("trunkId", "cidr");

-- CreateIndex
CREATE UNIQUE INDEX "caller_ids_organizationId_number_key" ON "caller_ids"("organizationId", "number");

-- CreateIndex
CREATE INDEX "phone_numbers_organizationId_status_idx" ON "phone_numbers"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_number_mode_key" ON "phone_numbers"("number", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "number_orders_idempotencyKey_key" ON "number_orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "porting_requests_organizationId_status_idx" ON "porting_requests"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "upstream_carriers_name_key" ON "upstream_carriers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "upstream_credentials_carrierId_name_key" ON "upstream_credentials"("carrierId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_capabilities_carrierId_name_key" ON "carrier_capabilities"("carrierId", "name");

-- CreateIndex
CREATE INDEX "carrier_routes_prefix_mode_enabled_idx" ON "carrier_routes"("prefix", "mode", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "rate_entries_rateDeckId_prefix_key" ON "rate_entries"("rateDeckId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "customer_rate_plans_organizationId_rateDeckId_key" ON "customer_rate_plans"("organizationId", "rateDeckId");

-- CreateIndex
CREATE INDEX "call_sessions_organizationId_mode_status_idx" ON "call_sessions"("organizationId", "mode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_id_organizationId_key" ON "call_sessions"("id", "organizationId");

-- CreateIndex
CREATE INDEX "call_events_callId_createdAt_idx" ON "call_events"("callId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "call_detail_records_callId_key" ON "call_detail_records"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "call_detail_records_idempotencyKey_key" ON "call_detail_records"("idempotencyKey");

-- CreateIndex
CREATE INDEX "call_detail_records_organizationId_mode_startTime_idx" ON "call_detail_records"("organizationId", "mode", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "call_detail_records_callId_organizationId_key" ON "call_detail_records"("callId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_organizationId_mode_currency_key" ON "wallets"("organizationId", "mode", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotencyKey_key" ON "ledger_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_entries_walletId_createdAt_idx" ON "ledger_entries"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerRef_key" ON "payments"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys"("hash");

-- CreateIndex
CREATE INDEX "api_keys_organizationId_idx" ON "api_keys"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_webhookId_eventId_attempt_key" ON "webhook_deliveries"("webhookId", "eventId", "attempt");

-- CreateIndex
CREATE INDEX "support_tickets_organizationId_status_idx" ON "support_tickets"("organizationId", "status");

-- CreateIndex
CREATE INDEX "fraud_alerts_organizationId_status_idx" ON "fraud_alerts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_requests" ADD CONSTRAINT "kyc_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sip_trunks" ADD CONSTRAINT "sip_trunks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sip_credentials" ADD CONSTRAINT "sip_credentials_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "sip_trunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_ips" ADD CONSTRAINT "authorized_ips_trunkId_fkey" FOREIGN KEY ("trunkId") REFERENCES "sip_trunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caller_ids" ADD CONSTRAINT "caller_ids_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caller_id_verifications" ADD CONSTRAINT "caller_id_verifications_callerIdId_fkey" FOREIGN KEY ("callerIdId") REFERENCES "caller_ids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_trunkId_organizationId_fkey" FOREIGN KEY ("trunkId", "organizationId") REFERENCES "sip_trunks"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_orders" ADD CONSTRAINT "number_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_orders" ADD CONSTRAINT "number_orders_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "phone_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "porting_requests" ADD CONSTRAINT "porting_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upstream_credentials" ADD CONSTRAINT "upstream_credentials_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "upstream_carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_capabilities" ADD CONSTRAINT "carrier_capabilities_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "upstream_carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_routes" ADD CONSTRAINT "carrier_routes_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "upstream_carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_decks" ADD CONSTRAINT "rate_decks_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "upstream_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_entries" ADD CONSTRAINT "rate_entries_rateDeckId_fkey" FOREIGN KEY ("rateDeckId") REFERENCES "rate_decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_rate_plans" ADD CONSTRAINT "customer_rate_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_rate_plans" ADD CONSTRAINT "customer_rate_plans_rateDeckId_fkey" FOREIGN KEY ("rateDeckId") REFERENCES "rate_decks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_trunkId_organizationId_fkey" FOREIGN KEY ("trunkId", "organizationId") REFERENCES "sip_trunks"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_callId_fkey" FOREIGN KEY ("callId") REFERENCES "call_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_detail_records" ADD CONSTRAINT "call_detail_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_detail_records" ADD CONSTRAINT "call_detail_records_callId_organizationId_fkey" FOREIGN KEY ("callId", "organizationId") REFERENCES "call_sessions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_detail_records" ADD CONSTRAINT "call_detail_records_trunkId_organizationId_fkey" FOREIGN KEY ("trunkId", "organizationId") REFERENCES "sip_trunks"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_detail_records" ADD CONSTRAINT "call_detail_records_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "upstream_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

