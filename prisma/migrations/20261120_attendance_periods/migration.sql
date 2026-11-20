ALTER TABLE "AttendanceSession"
  ADD COLUMN IF NOT EXISTS "period" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "AttendanceSession_teachingAssignmentId_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceSession_teachingAssignmentId_date_period_key"
  ON "AttendanceSession"("teachingAssignmentId", "date", "period");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendanceSession_period_check'
      AND conrelid = '"AttendanceSession"'::regclass
  ) THEN
    ALTER TABLE "AttendanceSession"
      ADD CONSTRAINT "AttendanceSession_period_check" CHECK ("period" BETWEEN 1 AND 8);
  END IF;
END
$$;
