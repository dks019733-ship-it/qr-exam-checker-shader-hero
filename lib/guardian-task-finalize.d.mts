import type { PrismaClient } from "@prisma/client";

export function finalizeGuardianTask(
  prisma: Pick<PrismaClient, "$transaction">,
  input: {
    taskId: string;
    taskData: {
      status: "SUCCEEDED" | "FAILED";
      currentStep: string;
      progressPercent: number;
      resultSummary: string;
      completedAt: Date;
      failureCode?: string;
    };
    eventData: {
      status: "SUCCEEDED" | "FAILED";
      step: string;
      message: string;
      progressPercent: number;
    };
  },
): Promise<boolean>;
