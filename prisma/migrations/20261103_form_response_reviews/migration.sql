CREATE TABLE IF NOT EXISTS "FormResponseReview" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "studentId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "questionScores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormResponseReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FormResponseReview_columnId_responseId_key" ON "FormResponseReview"("columnId", "responseId");
CREATE INDEX IF NOT EXISTS "FormResponseReview_columnId_idx" ON "FormResponseReview"("columnId");
CREATE INDEX IF NOT EXISTS "FormResponseReview_studentId_idx" ON "FormResponseReview"("studentId");
ALTER TABLE "FormResponseReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormResponseReview" ADD CONSTRAINT "FormResponseReview_columnId_fkey"
    FOREIGN KEY ("columnId") REFERENCES "GradeColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormResponseReview" ADD CONSTRAINT "FormResponseReview_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PendingFormScore" ADD COLUMN IF NOT EXISTS "room" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PendingFormScore" ADD COLUMN IF NOT EXISTS "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;
