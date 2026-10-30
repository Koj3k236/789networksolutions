-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdByUserId" UUID,
ADD COLUMN     "lastUsedAt" TIMESTAMPTZ(3),
ADD COLUMN     "rotatedFromId" UUID;

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "apiKeyId" UUID,
    "keyPrefix" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_logs_requestId_key" ON "api_usage_logs"("requestId");

-- CreateIndex
CREATE INDEX "api_usage_logs_organizationId_createdAt_idx" ON "api_usage_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "api_usage_logs_apiKeyId_createdAt_idx" ON "api_usage_logs"("apiKeyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_rotatedFromId_key" ON "api_keys"("rotatedFromId");

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_rotatedFromId_fkey" FOREIGN KEY ("rotatedFromId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

