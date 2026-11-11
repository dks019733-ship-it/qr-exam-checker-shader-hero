-- Existing Supabase submission objects are retained; new rows may point to Drive.
ALTER TABLE "SubmissionFile" ALTER COLUMN "objectKey" DROP NOT NULL;
ALTER TABLE "SubmissionFile" ADD COLUMN "driveFileId" TEXT;
CREATE UNIQUE INDEX "SubmissionFile_driveFileId_key" ON "SubmissionFile"("driveFileId");
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_storage_location_check"
CHECK (("objectKey" IS NOT NULL AND "driveFileId" IS NULL) OR ("objectKey" IS NULL AND "driveFileId" IS NOT NULL));
