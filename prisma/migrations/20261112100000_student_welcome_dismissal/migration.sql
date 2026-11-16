CREATE TABLE "StudentWelcomeDismissal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dismissedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentWelcomeDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentWelcomeDismissal_studentId_dismissedOn_key"
ON "StudentWelcomeDismissal"("studentId", "dismissedOn");

CREATE INDEX "StudentWelcomeDismissal_dismissedOn_idx"
ON "StudentWelcomeDismissal"("dismissedOn");

ALTER TABLE "StudentWelcomeDismissal"
ADD CONSTRAINT "StudentWelcomeDismissal_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
