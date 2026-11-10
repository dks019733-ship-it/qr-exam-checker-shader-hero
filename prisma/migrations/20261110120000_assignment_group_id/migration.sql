ALTER TABLE "Assignment"
ADD COLUMN "groupId" TEXT;

CREATE UNIQUE INDEX "Assignment_groupId_classId_key"
ON "Assignment"("groupId", "classId");
