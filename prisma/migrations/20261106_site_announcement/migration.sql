CREATE TABLE "SiteAnnouncement" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "message" VARCHAR(240) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'DEFAULT',
  "deploymentId" TEXT,
  "deploymentStatus" TEXT,
  "deploymentUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteAnnouncement_pkey" PRIMARY KEY ("id")
);
