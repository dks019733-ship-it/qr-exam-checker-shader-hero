-- Backfill coursework columns that were previously visible to students but had no
-- corresponding teacher-side Assignment record. The gradebook remains authoritative.
DO $$
DECLARE
  item record;
  new_assignment_id TEXT;
BEGIN
  FOR item IN
    SELECT
      gc."id",
      gc."ownerId",
      gc."classId",
      gc."teachingAssignmentId",
      gc."title",
      gc."maxScore",
      gc."googleFormId",
      gf."responderUrl"
    FROM "GradeColumn" gc
    LEFT JOIN "GoogleForm" gf ON gf."id" = gc."googleFormId"
    WHERE gc."assignmentId" IS NULL
      AND gc."examId" IS NULL
      AND gc."teachingAssignmentId" IS NOT NULL
    ORDER BY gc."createdAt", gc."id"
  LOOP
    new_assignment_id := gen_random_uuid()::TEXT;

    INSERT INTO "Assignment" (
      "id",
      "ownerId",
      "classId",
      "teachingAssignmentId",
      "title",
      "description",
      "mode",
      "status",
      "googleFormUrl",
      "maxScore",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      new_assignment_id,
      item."ownerId",
      item."classId",
      item."teachingAssignmentId",
      item."title",
      CASE
        WHEN item."googleFormId" IS NOT NULL THEN 'ทำแบบฝึกหัด/แบบทดสอบออนไลน์ผ่าน Google Forms'
        ELSE 'งานเก็บคะแนนในชั้นเรียน'
      END,
      CASE
        WHEN item."googleFormId" IS NOT NULL THEN 'GOOGLE_FORM'::"AssignmentMode"
        ELSE 'TEACHER_CHECK'::"AssignmentMode"
      END,
      'PUBLISHED'::"AssignmentStatus",
      CASE WHEN item."googleFormId" IS NOT NULL THEN item."responderUrl" ELSE NULL END,
      item."maxScore",
      NOW(),
      NOW()
    );

    UPDATE "GradeColumn"
    SET "assignmentId" = new_assignment_id
    WHERE "id" = item."id"
      AND "assignmentId" IS NULL;
  END LOOP;
END
$$;
