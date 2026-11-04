export async function createGuardianRetry(prisma, failedTask, notifyLineUserId) {
  if (failedTask.attempts >= failedTask.maxAttempts) return { status: "limit" };

  try {
    const task = await prisma.systemGuardianTask.create({
      data: {
        type: "SYSTEM_HEALTH_CHECK",
        requestedBy: failedTask.requestedBy,
        source: "LINE_RETRY",
        retryOfId: failedTask.id,
        notifyLineUserId,
        attempts: failedTask.attempts,
        maxAttempts: failedTask.maxAttempts,
        currentStep: "รอเริ่ม retry",
        events: {
          create: {
            status: "QUEUED",
            step: "RETRY_QUEUED",
            message: "เจ้าของระบบสั่ง retry งานตรวจระบบที่ล้มเหลว",
            progressPercent: 0,
          },
        },
      },
      select: { id: true },
    });
    return { status: "created", taskId: task.id };
  } catch (error) {
    if (error?.code === "P2002") return { status: "already_retried" };
    throw error;
  }
}
