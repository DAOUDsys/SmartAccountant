-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'IMPORT', 'FUTURE_AI_TOOL');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('API', 'MOBILE', 'SYSTEM_RETRY', 'IMPORT', 'BACKGROUND_JOB', 'FUTURE_AI_TOOL');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "actorUserId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "entityType" VARCHAR(100),
    "entityId" TEXT,
    "relatedEntityType" VARCHAR(100),
    "relatedEntityId" TEXT,
    "requestId" VARCHAR(100),
    "correlationId" VARCHAR(100),
    "source" "AuditSource" NOT NULL,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "reason" VARCHAR(500),
    "errorCode" VARCHAR(100),
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_businessId_occurredAt_idx" ON "AuditLog"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_eventType_occurredAt_idx" ON "AuditLog"("businessId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_entityType_entityId_idx" ON "AuditLog"("businessId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_actorUserId_occurredAt_idx" ON "AuditLog"("businessId", "actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
