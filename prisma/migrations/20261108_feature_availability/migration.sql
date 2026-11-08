CREATE TYPE "FeatureAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE');

CREATE TABLE "FeatureAvailability" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "status" "FeatureAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  "reason" VARCHAR(240) NOT NULL DEFAULT '',
  "untilAt" TIMESTAMP(3),
  "updatedBy" TEXT NOT NULL DEFAULT 'SYSTEM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureAvailability_key_key" ON "FeatureAvailability"("key");
CREATE INDEX "FeatureAvailability_status_untilAt_idx" ON "FeatureAvailability"("status", "untilAt");
