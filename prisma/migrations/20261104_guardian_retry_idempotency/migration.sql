ALTER TABLE "SystemGuardianTask"
ADD COLUMN "retryOfId" TEXT;

CREATE UNIQUE INDEX "SystemGuardianTask_retryOfId_key"
ON "SystemGuardianTask"("retryOfId");

ALTER TABLE "SystemGuardianTask"
ADD CONSTRAINT "SystemGuardianTask_retryOfId_fkey"
FOREIGN KEY ("retryOfId") REFERENCES "SystemGuardianTask"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
