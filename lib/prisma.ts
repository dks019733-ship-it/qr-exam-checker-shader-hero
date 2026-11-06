import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  dbBootstrapped?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Ensures critical new schema columns and tables exist in the database.
 * Uses IF NOT EXISTS so it is 100% idempotent and non-destructive.
 */
export async function ensureDatabaseSchema() {
  if (globalForPrisma.dbBootstrapped) return;
  globalForPrisma.dbBootstrapped = true;

  try {
    // 1. Ensure User.schoolKey exists
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolKey" TEXT;`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "schoolKey" = "id" WHERE "schoolKey" IS NULL;`);

    // 2. Ensure Student.identityId exists
    await prisma.$executeRawUnsafe(`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "identityId" TEXT;`);

    // 3. Ensure Exam & GradeColumn links
    await prisma.$executeRawUnsafe(`ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "teachingAssignmentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "GradeColumn" ADD COLUMN IF NOT EXISTS "teachingAssignmentId" TEXT;`);

    // 4. Ensure StudentIdentity table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StudentIdentity" (
        "id" TEXT NOT NULL,
        "schoolKey" TEXT NOT NULL DEFAULT 'default',
        "className" TEXT NOT NULL,
        "studentNo" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "pinHash" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
      );
    `);

    // 5. Ensure Subject table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Subject" (
        "id" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
      );
    `);

    // 6. Ensure TeachingAssignment table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TeachingAssignment" (
        "id" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
        "subjectId" TEXT NOT NULL,
        "classId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
      );
    `);

    // 7. Ensure CourseEnrollment table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseEnrollment" (
        "id" TEXT NOT NULL,
        "assignmentId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
      );
    `);

    // 8. Ensure SiteAnnouncement table
    await prisma.$executeRawUnsafe(`
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
    `);
  } catch (err) {
    console.warn("[DB] Schema auto-ensure warning:", err);
  }
}

// Auto-trigger background check
ensureDatabaseSchema().catch(() => {});
