ALTER TABLE "Assignment"
ADD COLUMN IF NOT EXISTS "groupId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_groupId_classId_key"
ON "Assignment"("groupId", "classId");
