ALTER TABLE "GradeColumn" ADD COLUMN IF NOT EXISTS "sourceColumnId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "GradeColumn_sourceColumnId_classId_key" ON "GradeColumn"("sourceColumnId", "classId");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeColumn_sourceColumnId_fkey') THEN
        ALTER TABLE "GradeColumn" ADD CONSTRAINT "GradeColumn_sourceColumnId_fkey"
            FOREIGN KEY ("sourceColumnId") REFERENCES "GradeColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
