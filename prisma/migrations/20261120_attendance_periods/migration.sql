ALTER TABLE "AttendanceSession"
  ADD COLUMN IF NOT EXISTS "period" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "AttendanceSession_teachingAssignmentId_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceSession_teachingAssignmentId_date_period_key"
  ON "AttendanceSession"("teachingAssignmentId", "date", "period");
