-- Additive System Guardian schema. This migration does not modify exam, student, or grade data.
CREATE TYPE "SystemIncidentSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
CREATE TYPE "SystemIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "SystemGuardianTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "SystemGuardianTaskType" AS ENUM ('SYSTEM_HEALTH_CHECK');

CREATE TABLE "SystemIncident" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" "SystemIncidentSeverity" NOT NULL,
    "status" "SystemIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "route" TEXT,
    "httpStatus" INTEGER,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemGuardianAuditLog" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "outcome" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemGuardianAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LineWebhookEvent" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemGuardianTask" (
    "id" TEXT NOT NULL,
    "type" "SystemGuardianTaskType" NOT NULL,
    "status" "SystemGuardianTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedBy" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "notifyLineUserId" TEXT,
    "currentStep" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "resultSummary" TEXT,
    "failureCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemGuardianTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemGuardianTaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "SystemGuardianTaskStatus" NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "progressPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemGuardianTaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemIncident_fingerprint_key" ON "SystemIncident"("fingerprint");
CREATE INDEX "SystemIncident_status_severity_lastSeenAt_idx" ON "SystemIncident"("status", "severity", "lastSeenAt");
CREATE INDEX "SystemIncident_source_lastSeenAt_idx" ON "SystemIncident"("source", "lastSeenAt");
CREATE INDEX "SystemGuardianAuditLog_actorEmail_createdAt_idx" ON "SystemGuardianAuditLog"("actorEmail", "createdAt");
CREATE INDEX "SystemGuardianAuditLog_action_createdAt_idx" ON "SystemGuardianAuditLog"("action", "createdAt");
CREATE UNIQUE INDEX "LineWebhookEvent_webhookEventId_key" ON "LineWebhookEvent"("webhookEventId");
CREATE INDEX "LineWebhookEvent_processedAt_idx" ON "LineWebhookEvent"("processedAt");
CREATE INDEX "SystemGuardianTask_status_createdAt_idx" ON "SystemGuardianTask"("status", "createdAt");
CREATE INDEX "SystemGuardianTask_requestedBy_createdAt_idx" ON "SystemGuardianTask"("requestedBy", "createdAt");
CREATE INDEX "SystemGuardianTaskEvent_taskId_createdAt_idx" ON "SystemGuardianTaskEvent"("taskId", "createdAt");

ALTER TABLE "SystemGuardianTaskEvent"
ADD CONSTRAINT "SystemGuardianTaskEvent_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "SystemGuardianTask"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
