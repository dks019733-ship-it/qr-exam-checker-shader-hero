ALTER TABLE "GradeColumn"
  ADD COLUMN IF NOT EXISTS "assignmentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GradeColumn_assignmentId_key"
  ON "GradeColumn"("assignmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GradeColumn_assignmentId_fkey'
      AND conrelid = '"GradeColumn"'::regclass
  ) THEN
    ALTER TABLE "GradeColumn"
      ADD CONSTRAINT "GradeColumn_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
