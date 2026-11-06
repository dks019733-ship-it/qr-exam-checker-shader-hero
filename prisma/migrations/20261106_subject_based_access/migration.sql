ALTER TABLE "User" ADD COLUMN "schoolKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Student" ADD COLUMN "identityId" TEXT;
ALTER TABLE "Exam" ADD COLUMN "teachingAssignmentId" TEXT;
ALTER TABLE "GradeColumn" ADD COLUMN "teachingAssignmentId" TEXT;

CREATE TABLE "Subject" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeachingAssignment" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CourseEnrollment" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StudentIdentity" (
  "id" TEXT NOT NULL,
  "schoolKey" TEXT NOT NULL DEFAULT 'default',
  "className" TEXT NOT NULL,
  "studentNo" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pinHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subject_ownerId_code_key" ON "Subject"("ownerId", "code");
CREATE INDEX "Subject_ownerId_name_idx" ON "Subject"("ownerId", "name");
CREATE UNIQUE INDEX "TeachingAssignment_subjectId_classId_key" ON "TeachingAssignment"("subjectId", "classId");
CREATE INDEX "TeachingAssignment_ownerId_classId_idx" ON "TeachingAssignment"("ownerId", "classId");
CREATE INDEX "TeachingAssignment_ownerId_subjectId_idx" ON "TeachingAssignment"("ownerId", "subjectId");
CREATE UNIQUE INDEX "CourseEnrollment_assignmentId_studentId_key" ON "CourseEnrollment"("assignmentId", "studentId");
CREATE INDEX "CourseEnrollment_studentId_idx" ON "CourseEnrollment"("studentId");
CREATE UNIQUE INDEX "StudentIdentity_schoolKey_className_studentNo_key" ON "StudentIdentity"("schoolKey", "className", "studentNo");
CREATE INDEX "StudentIdentity_schoolKey_studentNo_idx" ON "StudentIdentity"("schoolKey", "studentNo");
CREATE INDEX "Student_identityId_idx" ON "Student"("identityId");
CREATE INDEX "Exam_teachingAssignmentId_idx" ON "Exam"("teachingAssignmentId");
CREATE INDEX "GradeColumn_teachingAssignmentId_idx" ON "GradeColumn"("teachingAssignmentId");

ALTER TABLE "Subject" ADD CONSTRAINT "Subject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "StudentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GradeColumn" ADD CONSTRAINT "GradeColumn_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
