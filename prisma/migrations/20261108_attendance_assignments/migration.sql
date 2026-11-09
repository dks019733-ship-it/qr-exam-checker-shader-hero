CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'LATE');
CREATE TYPE "AssignmentMode" AS ENUM ('TEACHER_CHECK', 'SYSTEM_UPLOAD', 'GOOGLE_FORM');
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'RETURNED');

CREATE TABLE "AttendanceSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ownerId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teachingAssignmentId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "topic" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceRecord" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ownerId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teachingAssignmentId" TEXT NOT NULL,
  "attendanceSessionId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "mode" "AssignmentMode" NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
  "googleFormUrl" TEXT,
  "dueAt" TIMESTAMP(3),
  "maxScore" DOUBLE PRECISION,
  "autoMarkAttendance" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssignmentFile" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "assignmentId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentFile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Submission" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "score" DOUBLE PRECISION,
  "feedback" TEXT NOT NULL DEFAULT '',
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SubmissionFile" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "submissionId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceSession_teachingAssignmentId_date_key" ON "AttendanceSession"("teachingAssignmentId", "date");
CREATE INDEX "AttendanceSession_ownerId_classId_date_idx" ON "AttendanceSession"("ownerId", "classId", "date");
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");
CREATE INDEX "AttendanceRecord_studentId_updatedAt_idx" ON "AttendanceRecord"("studentId", "updatedAt");
CREATE INDEX "Assignment_ownerId_classId_status_dueAt_idx" ON "Assignment"("ownerId", "classId", "status", "dueAt");
CREATE INDEX "Assignment_teachingAssignmentId_createdAt_idx" ON "Assignment"("teachingAssignmentId", "createdAt");
CREATE UNIQUE INDEX "AssignmentFile_objectKey_key" ON "AssignmentFile"("objectKey");
CREATE INDEX "AssignmentFile_assignmentId_idx" ON "AssignmentFile"("assignmentId");
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");
CREATE INDEX "Submission_studentId_submittedAt_idx" ON "Submission"("studentId", "submittedAt");
CREATE INDEX "Submission_assignmentId_status_idx" ON "Submission"("assignmentId", "status");
CREATE UNIQUE INDEX "SubmissionFile_objectKey_key" ON "SubmissionFile"("objectKey");
CREATE INDEX "SubmissionFile_submissionId_idx" ON "SubmissionFile"("submissionId");

ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssignmentFile" ADD CONSTRAINT "AssignmentFile_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
