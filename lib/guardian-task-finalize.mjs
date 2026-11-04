export async function finalizeGuardianTask(prisma, input) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.systemGuardianTask.updateMany({
      where: { id: input.taskId, status: "RUNNING" },
      data: input.taskData,
    });
    if (updated.count !== 1) return false;

    await tx.systemGuardianTaskEvent.create({
      data: { taskId: input.taskId, ...input.eventData },
    });
    return true;
  });
}
