ALTER TABLE "GradeColumn" ADD COLUMN "assignmentId" TEXT;

CREATE UNIQUE INDEX "GradeColumn_assignmentId_key" ON "GradeColumn"("assignmentId");

ALTER TABLE "GradeColumn"
  ADD CONSTRAINT "GradeColumn_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
