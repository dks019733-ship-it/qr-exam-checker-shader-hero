ALTER TABLE "GradeScore"
  ADD COLUMN IF NOT EXISTS "manualOverride" BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing Google Forms scores may already contain teacher edits. Protect them
-- rather than guessing whether they were machine-imported or manually changed.
UPDATE "GradeScore" AS score
SET "manualOverride" = TRUE
FROM "GradeColumn" AS destination
WHERE score."columnId" = destination."id"
  AND (
    destination."googleFormId" IS NOT NULL
    OR destination."sourceColumnId" IN (
      SELECT source."id"
      FROM "GradeColumn" AS source
      WHERE source."googleFormId" IS NOT NULL
    )
    OR destination."assignmentId" IN (
      SELECT assignment."id"
      FROM "Assignment" AS assignment
      WHERE assignment."mode" = 'GOOGLE_FORM'
    )
  );
