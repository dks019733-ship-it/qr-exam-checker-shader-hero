CREATE TABLE "TeacherAiMemory" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "preferences" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherAiMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherAiMemory_ownerId_key" ON "TeacherAiMemory"("ownerId");
ALTER TABLE "TeacherAiMemory" ADD CONSTRAINT "TeacherAiMemory_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
