-- CreateEnum
CREATE TYPE "CallerIdPermissionStatus" AS ENUM ('DISABLED', 'REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CallerIdRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallerIdAuthorizationStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'REJECTED', 'REVOKED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allowPerCallCallerIdSelection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "callerIdApprovalNotes" TEXT,
ADD COLUMN     "callerIdPermissionStatus" "CallerIdPermissionStatus" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN     "callerIdPermissionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "callerIdPermissionsUpdatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "callerIdPermissionsUpdatedById" UUID,
ADD COLUMN     "externalCallerIdPassthroughEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireAdditionalCallerIdReview" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "caller_ids" ADD COLUMN     "additionalReviewAt" TIMESTAMPTZ(3),
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "status" "CallerIdAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "submittedAuthorization" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "caller_id_verifications" ADD COLUMN     "evidenceReference" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reviewedById" UUID;

-- CreateTable
CREATE TABLE "caller_id_permission_requests" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "CallerIdRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "decisionNotes" TEXT,

    CONSTRAINT "caller_id_permission_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caller_id_permission_requests_organizationId_status_created_idx" ON "caller_id_permission_requests"("organizationId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "caller_id_permission_requests" ADD CONSTRAINT "caller_id_permission_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caller_id_permission_requests" ADD CONSTRAINT "caller_id_permission_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caller_id_permission_requests" ADD CONSTRAINT "caller_id_permission_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_callerIdPermissionsUpdatedById_fkey" FOREIGN KEY ("callerIdPermissionsUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caller_id_verifications" ADD CONSTRAINT "caller_id_verifications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Enforce one outstanding enablement request per tenant, including concurrent clients.
CREATE UNIQUE INDEX "caller_id_one_pending_request_per_org"
ON "caller_id_permission_requests" ("organizationId") WHERE "status" = 'PENDING';
-- An enabled flag must never coexist with an unapproved permission state.
ALTER TABLE "organizations" ADD CONSTRAINT "caller_id_permission_enabled_requires_approval"
CHECK (NOT "externalCallerIdPassthroughEnabled" OR "callerIdPermissionStatus" = 'APPROVED');
-- Existing Caller IDs deliberately remain PENDING; legacy verified booleans alone
-- do not prove documented authorization or satisfy the new policy evaluator.
