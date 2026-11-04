import type { PrismaClient } from "@prisma/client";

export function createGuardianRetry(
  prisma: Pick<PrismaClient, "systemGuardianTask">,
  failedTask: {
    id: string;
    requestedBy: string;
    attempts: number;
    maxAttempts: number;
  },
  notifyLineUserId: string,
): Promise<
  | { status: "limit" }
  | { status: "already_retried" }
  | { status: "created"; taskId: string }
>;
