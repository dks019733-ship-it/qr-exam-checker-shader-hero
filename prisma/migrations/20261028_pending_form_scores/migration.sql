CREATE TABLE IF NOT EXISTS "PendingFormScore" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL DEFAULT '',
    "studentName" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PendingFormScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingFormScore_columnId_responseId_key"
    ON "PendingFormScore"("columnId", "responseId");

CREATE INDEX IF NOT EXISTS "PendingFormScore_columnId_idx"
    ON "PendingFormScore"("columnId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PendingFormScore_columnId_fkey'
    ) THEN
        ALTER TABLE "PendingFormScore"
            ADD CONSTRAINT "PendingFormScore_columnId_fkey"
            FOREIGN KEY ("columnId") REFERENCES "GradeColumn"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
