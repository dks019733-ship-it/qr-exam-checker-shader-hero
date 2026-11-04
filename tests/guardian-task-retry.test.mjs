import test from "node:test";
import assert from "node:assert/strict";
import { createGuardianRetry } from "../lib/guardian-task-retry.mjs";

const failedTask = {
  id: "failed-task",
  requestedBy: "owner@example.com",
  attempts: 1,
  maxAttempts: 2,
};

test("creates one retry linked to its failed task", async () => {
  let createArgs;
  const prisma = {
    systemGuardianTask: {
      async create(args) {
        createArgs = args;
        return { id: "retry-task" };
      },
    },
  };

  assert.deepEqual(await createGuardianRetry(prisma, failedTask, "line-owner"), {
    status: "created",
    taskId: "retry-task",
  });
  assert.equal(createArgs.data.retryOfId, failedTask.id);
  assert.equal(createArgs.data.attempts, failedTask.attempts);
});

test("does not schedule retries beyond the attempt limit", async () => {
  let createCalled = false;
  const prisma = {
    systemGuardianTask: {
      async create() {
        createCalled = true;
      },
    },
  };

  assert.deepEqual(
    await createGuardianRetry(prisma, { ...failedTask, attempts: 2 }, "line-owner"),
    { status: "limit" },
  );
  assert.equal(createCalled, false);
});

test("reports a unique retry conflict instead of creating duplicate work", async () => {
  const prisma = {
    systemGuardianTask: {
      async create() {
        throw Object.assign(new Error("unique conflict"), { code: "P2002" });
      },
    },
  };

  assert.deepEqual(
    await createGuardianRetry(prisma, failedTask, "line-owner"),
    { status: "already_retried" },
  );
});
