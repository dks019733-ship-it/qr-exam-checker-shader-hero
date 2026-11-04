import test from "node:test";
import assert from "node:assert/strict";
import { finalizeGuardianTask } from "../lib/guardian-task-finalize.mjs";

function createPrisma(updateCount) {
  const calls = [];
  const transactionClient = {
    systemGuardianTask: {
      async updateMany(args) {
        calls.push(["update", args]);
        return { count: updateCount };
      },
    },
    systemGuardianTaskEvent: {
      async create(args) {
        calls.push(["event", args]);
      },
    },
  };
  return {
    calls,
    async $transaction(callback) {
      return callback(transactionClient);
    },
  };
}

const input = {
  taskId: "task-1",
  taskData: {
    status: "SUCCEEDED",
    currentStep: "done",
    progressPercent: 100,
    resultSummary: "ok",
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  eventData: {
    status: "SUCCEEDED",
    step: "COMPLETED",
    message: "ok",
    progressPercent: 100,
  },
};

test("finalizes only a running task and writes its event atomically", async () => {
  const prisma = createPrisma(1);

  assert.equal(await finalizeGuardianTask(prisma, input), true);
  assert.deepEqual(prisma.calls.map(([kind]) => kind), ["update", "event"]);
  assert.deepEqual(prisma.calls[0][1].where, { id: "task-1", status: "RUNNING" });
  assert.equal(prisma.calls[1][1].data.taskId, "task-1");
});

test("does not overwrite a task already marked failed after a timeout", async () => {
  const prisma = createPrisma(0);

  assert.equal(await finalizeGuardianTask(prisma, input), false);
  assert.deepEqual(prisma.calls.map(([kind]) => kind), ["update"]);
});
