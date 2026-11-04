import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createGuardianRetry } from "../lib/guardian-task-retry.mjs";
import { finalizeGuardianTask } from "../lib/guardian-task-finalize.mjs";

test("Guardian database concurrency invariants", {
  skip: !process.env.DATABASE_URL,
}, async (t) => {
  const prisma = new PrismaClient();
  const createdTaskIds = [];
  const createTask = async (status) => {
    const task = await prisma.systemGuardianTask.create({
      data: {
        type: "SYSTEM_HEALTH_CHECK",
        status,
        requestedBy: "guardian-integration-test",
        maxAttempts: 2,
      },
      select: { id: true },
    });
    createdTaskIds.push(task.id);
    return task.id;
  };

  try {
    await t.test("only one concurrent worker can claim a queued task", async () => {
      const id = await createTask("QUEUED");
      const claims = await Promise.all([
        prisma.systemGuardianTask.updateMany({
          where: { id, status: "QUEUED" },
          data: { status: "RUNNING", attempts: { increment: 1 } },
        }),
        prisma.systemGuardianTask.updateMany({
          where: { id, status: "QUEUED" },
          data: { status: "RUNNING", attempts: { increment: 1 } },
        }),
      ]);
      assert.deepEqual(claims.map((item) => item.count).sort(), [0, 1]);
      const task = await prisma.systemGuardianTask.findUniqueOrThrow({ where: { id } });
      assert.equal(task.attempts, 1);
    });

    await t.test("concurrent finalization writes exactly one terminal event", async () => {
      const id = await createTask("RUNNING");
      const input = {
        taskId: id,
        taskData: {
          status: "SUCCEEDED",
          currentStep: "done",
          progressPercent: 100,
          resultSummary: "integration test",
          completedAt: new Date(),
        },
        eventData: {
          status: "SUCCEEDED",
          step: "COMPLETED",
          message: "integration test",
          progressPercent: 100,
        },
      };
      const results = await Promise.all([
        finalizeGuardianTask(prisma, input),
        finalizeGuardianTask(prisma, input),
      ]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(await prisma.systemGuardianTaskEvent.count({ where: { taskId: id } }), 1);
    });

    await t.test("concurrent retry requests create at most one retry", async () => {
      const id = await createTask("FAILED");
      const failedTask = {
        id,
        requestedBy: "guardian-integration-test",
        attempts: 1,
        maxAttempts: 2,
      };
      const results = await Promise.all([
        createGuardianRetry(prisma, failedTask, "line-owner-test"),
        createGuardianRetry(prisma, failedTask, "line-owner-test"),
      ]);
      assert.equal(results.filter((item) => item.status === "created").length, 1);
      assert.equal(results.filter((item) => item.status === "already_retried").length, 1);
      const retries = await prisma.systemGuardianTask.findMany({
        where: { retryOfId: id },
        select: { id: true },
      });
      assert.equal(retries.length, 1);
      createdTaskIds.push(...retries.map((item) => item.id));
    });

    await t.test("cancellation and worker claim cannot both win", async () => {
      const id = await createTask("QUEUED");
      const [cancel, claim] = await Promise.all([
        prisma.systemGuardianTask.updateMany({
          where: { id, status: "QUEUED" },
          data: { status: "CANCELLED", completedAt: new Date() },
        }),
        prisma.systemGuardianTask.updateMany({
          where: { id, status: "QUEUED" },
          data: { status: "RUNNING", startedAt: new Date() },
        }),
      ]);
      assert.equal(cancel.count + claim.count, 1);
    });

    await t.test("stale recovery and worker finalization cannot overwrite each other", async () => {
      const id = await createTask("RUNNING");
      const recovery = prisma.$transaction(async (tx) => {
        const changed = await tx.systemGuardianTask.updateMany({
          where: { id, status: "RUNNING" },
          data: {
            status: "FAILED",
            failureCode: "WORKER_TIMEOUT",
            completedAt: new Date(),
          },
        });
        if (changed.count !== 1) return false;
        await tx.systemGuardianTaskEvent.create({
          data: {
            taskId: id,
            status: "FAILED",
            step: "WORKER_TIMEOUT",
            message: "integration test recovery",
          },
        });
        return true;
      });
      const finalization = finalizeGuardianTask(prisma, {
        taskId: id,
        taskData: {
          status: "SUCCEEDED",
          currentStep: "done",
          progressPercent: 100,
          resultSummary: "integration test",
          completedAt: new Date(),
        },
        eventData: {
          status: "SUCCEEDED",
          step: "COMPLETED",
          message: "integration test",
          progressPercent: 100,
        },
      });
      await Promise.all([recovery, finalization]);
      const task = await prisma.systemGuardianTask.findUniqueOrThrow({ where: { id } });
      assert.ok(["FAILED", "SUCCEEDED"].includes(task.status));
      assert.equal(await prisma.systemGuardianTaskEvent.count({ where: { taskId: id } }), 1);
    });
  } finally {
    await prisma.systemGuardianTask.deleteMany({
      where: { id: { in: createdTaskIds } },
    });
    await prisma.$disconnect();
  }
});
