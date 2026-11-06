import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  dbBootstrapped?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function safeExecute(sql: string, description: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (err: unknown) {
    console.warn(`[DB] ${description} notice:`, (err as Error)?.message || err);
  }
}

let bootstrapPromise: Promise<void> | null = null;

/**
 * Ensures critical schema columns, tables, and unique constraints exist in the database.
 * Uses IF NOT EXISTS and safe execution so it is 100% idempotent and non-destructive.
 */
export async function ensureDatabaseSchema() {
  if (globalForPrisma.dbBootstrapped) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      // 1. User & Student columns
      await safeExecute(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolKey" TEXT;`, "User.schoolKey");
      await safeExecute(`UPDATE "User" SET "schoolKey" = "id" WHERE "schoolKey" IS NULL;`, "backfill User.schoolKey");
      await safeExecute(`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "identityId" TEXT;`, "Student.identityId");
      await safeExecute(`ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "teachingAssignmentId" TEXT;`, "Exam.teachingAssignmentId");
      await safeExecute(`ALTER TABLE "GradeColumn" ADD COLUMN IF NOT EXISTS "teachingAssignmentId" TEXT;`, "GradeColumn.teachingAssignmentId");

      // 2. StudentIdentity table
      await safeExecute(`
        CREATE TABLE IF NOT EXISTS "StudentIdentity" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "schoolKey" TEXT NOT NULL DEFAULT 'default',
          "className" TEXT NOT NULL,
          "studentNo" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "pinHash" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
        );
      `, "Table StudentIdentity");

      // 3. Subject table
      await safeExecute(`
        CREATE TABLE IF NOT EXISTS "Subject" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "ownerId" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
        );
      `, "Table Subject");

      // 4. TeachingAssignment table
      await safeExecute(`
        CREATE TABLE IF NOT EXISTS "TeachingAssignment" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "ownerId" TEXT NOT NULL,
          "subjectId" TEXT NOT NULL,
          "classId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
        );
      `, "Table TeachingAssignment");

      // 5. CourseEnrollment table
      await safeExecute(`
        CREATE TABLE IF NOT EXISTS "CourseEnrollment" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "assignmentId" TEXT NOT NULL,
          "studentId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
        );
      `, "Table CourseEnrollment");

      // 6. SiteAnnouncement table
      await safeExecute(`
        CREATE TABLE IF NOT EXISTS "SiteAnnouncement" (
          "id" TEXT NOT NULL DEFAULT 'global',
          "message" VARCHAR(240) NOT NULL,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "source" TEXT NOT NULL DEFAULT 'DEFAULT',
          "deploymentId" TEXT,
          "deploymentStatus" TEXT,
          "deploymentUrl" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SiteAnnouncement_pkey" PRIMARY KEY ("id")
        );
      `, "Table SiteAnnouncement");

      // 7. Ensure ID column default gen_random_uuid() for newly created or existing tables
      await safeExecute(`ALTER TABLE "Subject" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;`, "Subject.id default");
      await safeExecute(`ALTER TABLE "TeachingAssignment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;`, "TeachingAssignment.id default");
      await safeExecute(`ALTER TABLE "CourseEnrollment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;`, "CourseEnrollment.id default");
      await safeExecute(`ALTER TABLE "StudentIdentity" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;`, "StudentIdentity.id default");

      // 8. UNIQUE INDEXES required by Prisma upsert / relations
      await safeExecute(`CREATE UNIQUE INDEX IF NOT EXISTS "Subject_ownerId_code_key" ON "Subject"("ownerId", "code");`, "Index Subject_ownerId_code_key");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "Subject_ownerId_name_idx" ON "Subject"("ownerId", "name");`, "Index Subject_ownerId_name_idx");

      await safeExecute(`CREATE UNIQUE INDEX IF NOT EXISTS "TeachingAssignment_subjectId_classId_key" ON "TeachingAssignment"("subjectId", "classId");`, "Index TeachingAssignment_subjectId_classId_key");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "TeachingAssignment_ownerId_classId_idx" ON "TeachingAssignment"("ownerId", "classId");`, "Index TeachingAssignment_ownerId_classId_idx");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "TeachingAssignment_ownerId_subjectId_idx" ON "TeachingAssignment"("ownerId", "subjectId");`, "Index TeachingAssignment_ownerId_subjectId_idx");

      await safeExecute(`CREATE UNIQUE INDEX IF NOT EXISTS "CourseEnrollment_assignmentId_studentId_key" ON "CourseEnrollment"("assignmentId", "studentId");`, "Index CourseEnrollment_assignmentId_studentId_key");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "CourseEnrollment_studentId_idx" ON "CourseEnrollment"("studentId");`, "Index CourseEnrollment_studentId_idx");

      await safeExecute(`CREATE UNIQUE INDEX IF NOT EXISTS "StudentIdentity_schoolKey_className_studentNo_key" ON "StudentIdentity"("schoolKey", "className", "studentNo");`, "Index StudentIdentity_schoolKey_className_studentNo_key");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "StudentIdentity_schoolKey_studentNo_idx" ON "StudentIdentity"("schoolKey", "studentNo");`, "Index StudentIdentity_schoolKey_studentNo_idx");

      await safeExecute(`CREATE INDEX IF NOT EXISTS "Student_identityId_idx" ON "Student"("identityId");`, "Index Student_identityId_idx");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "Exam_teachingAssignmentId_idx" ON "Exam"("teachingAssignmentId");`, "Index Exam_teachingAssignmentId_idx");
      await safeExecute(`CREATE INDEX IF NOT EXISTS "GradeColumn_teachingAssignmentId_idx" ON "GradeColumn"("teachingAssignmentId");`, "Index GradeColumn_teachingAssignmentId_idx");

      // 9. Foreign keys
      await safeExecute(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subject_ownerId_fkey') THEN
            ALTER TABLE "Subject" ADD CONSTRAINT "Subject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeachingAssignment_ownerId_fkey') THEN
            ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeachingAssignment_subjectId_fkey') THEN
            ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeachingAssignment_classId_fkey') THEN
            ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseEnrollment_assignmentId_fkey') THEN
            ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseEnrollment_studentId_fkey') THEN
            ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Student_identityId_fkey') THEN
            ALTER TABLE "Student" ADD CONSTRAINT "Student_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "StudentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_teachingAssignmentId_fkey') THEN
            ALTER TABLE "Exam" ADD CONSTRAINT "Exam_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeColumn_teachingAssignmentId_fkey') THEN
            ALTER TABLE "GradeColumn" ADD CONSTRAINT "GradeColumn_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;
      `, "Foreign keys");

      globalForPrisma.dbBootstrapped = true;
    } catch (err) {
      console.warn("[DB] Schema auto-ensure warning:", err);
    }
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

// Auto-trigger background check
ensureDatabaseSchema().catch(() => {});
