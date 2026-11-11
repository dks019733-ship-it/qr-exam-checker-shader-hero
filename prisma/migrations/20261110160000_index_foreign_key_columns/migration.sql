CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Exam_classId_idx" ON "Exam"("classId");
CREATE INDEX IF NOT EXISTS "TeachingAssignment_classId_idx" ON "TeachingAssignment"("classId");
CREATE INDEX IF NOT EXISTS "GradeColumn_classId_idx" ON "GradeColumn"("classId");
CREATE INDEX IF NOT EXISTS "Assignment_classId_idx" ON "Assignment"("classId");
CREATE INDEX IF NOT EXISTS "Assignment_attendanceSessionId_idx" ON "Assignment"("attendanceSessionId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_classId_idx" ON "AttendanceSession"("classId");
