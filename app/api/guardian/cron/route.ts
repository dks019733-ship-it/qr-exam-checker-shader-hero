import { NextResponse } from "next/server";
import { isValidCronSecret, recordSystemIncident } from "@/lib/system-guardian";
import { pushLineMessage } from "@/lib/line-guardian";
import { prisma } from "@/lib/prisma";
import { finalizeGuardianTask } from "@/lib/guardian-task-finalize.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function recoverStaleTask(): Promise<void> {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const stale = await prisma.systemGuardianTask.findFirst({
    where: { status: "RUNNING", updatedAt: { lt: staleBefore } },
    orderBy: { updatedAt: "asc" },
    select: { id: true, notifyLineUserId: true },
  });
  if (!stale) return;

  const recovered = await prisma.$transaction(async (tx) => {
    const updated = await tx.systemGuardianTask.updateMany({
      where: { id: stale.id, status: "RUNNING", updatedAt: { lt: staleBefore } },
      data: {
        status: "FAILED",
        currentStep: "งานหมดเวลารอและถูกปิดสถานะ",
        failureCode: "WORKER_TIMEOUT",
        resultSummary: "ไม่พบการอัปเดตจาก worker ภายใน 10 นาที งานถูกปิดเพื่อไม่ให้ค้างในสถานะกำลังทำ",
        completedAt: new Date(),
      },
    });
    if (updated.count !== 1) return false;
    await tx.systemGuardianTaskEvent.create({
      data: {
        taskId: stale.id,
        status: "FAILED",
        step: "WORKER_TIMEOUT",
        message: "ปิดงานที่ค้างเกิน 10 นาทีแล้ว สามารถ retry ได้หากยังอยู่ในขีดจำกัด",
      },
    });
    return true;
  });
  if (!recovered) return;

  if (stale.notifyLineUserId) {
    await pushLineMessage(stale.notifyLineUserId, "System Guardian\nงานตรวจสอบหมดเวลารอและถูกปิดสถานะแล้ว สามารถสั่ง “ลองงานที่ล้มเหลวใหม่” ได้หากยังไม่เกินจำนวน retry");
  }
}

async function processNextTask(): Promise<boolean> {
  const candidate = await prisma.systemGuardianTask.findFirst({
    where: { status: "QUEUED", type: "SYSTEM_HEALTH_CHECK" },
    orderBy: { createdAt: "asc" },
    select: { id: true, notifyLineUserId: true },
  });
  if (!candidate) return false;

  // Atomic claim prevents overlapping cron invocations from executing one task twice.
  const claimed = await prisma.systemGuardianTask.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      currentStep: "กำลังตรวจสอบฐานข้อมูล",
      progressPercent: 25,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return false;

  try {
    await prisma.systemGuardianTaskEvent.create({
      data: {
        taskId: candidate.id,
        status: "RUNNING",
        step: "DATABASE_CHECK",
        message: "เริ่มตรวจสอบการเชื่อมต่อฐานข้อมูล",
        progressPercent: 25,
      },
    });

    await prisma.$queryRaw`SELECT 1`;
    const openIncidents = await prisma.systemIncident.count({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    });
    const summary = `ตรวจสอบฐานข้อมูลสำเร็จ · Incident ที่ยังเปิดอยู่ ${openIncidents} รายการ`;

    const completed = await finalizeGuardianTask(prisma, {
      taskId: candidate.id,
      taskData: {
        status: "SUCCEEDED",
        currentStep: "ตรวจสอบเสร็จแล้ว",
        progressPercent: 100,
        resultSummary: summary,
        completedAt: new Date(),
      },
      eventData: {
        status: "SUCCEEDED",
        step: "COMPLETED",
        message: summary,
        progressPercent: 100,
      },
    });

    if (completed && candidate.notifyLineUserId) {
      await pushLineMessage(candidate.notifyLineUserId, `System Guardian\nงานตรวจสอบเสร็จแล้ว\n${summary}`);
    }
    return true;
  } catch {
    // If the database itself is unavailable, these writes can fail too; the stale-task
    // recovery above closes the task on a later successful cron invocation.
    const failed = await finalizeGuardianTask(prisma, {
      taskId: candidate.id,
      taskData: {
        status: "FAILED",
        currentStep: "การตรวจสอบล้มเหลว",
        progressPercent: 25,
        resultSummary: "ตรวจสอบไม่สำเร็จ ระบบไม่สามารถยืนยันสถานะฐานข้อมูลได้",
        failureCode: "HEALTH_CHECK_FAILED",
        completedAt: new Date(),
      },
      eventData: {
        status: "FAILED",
        step: "FAILED",
        message: "ตรวจสอบไม่สำเร็จ ระบบไม่สามารถยืนยันสถานะฐานข้อมูลได้",
        progressPercent: 25,
      },
    });
    if (failed && candidate.notifyLineUserId) {
      await pushLineMessage(candidate.notifyLineUserId, "System Guardian\nตรวจสอบไม่สำเร็จ ระบบไม่สามารถยืนยันสถานะฐานข้อมูลได้");
    }
    return true;
  }
}

export async function GET(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.lineWebhookEvent.deleteMany({
      where: { processedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    await recoverStaleTask();
    const taskProcessed = await processNextTask();
    return NextResponse.json({
      ok: true,
      checks: { database: "ok" },
      taskProcessed,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    try {
      await recordSystemIncident({
        source: "guardian-cron",
        severity: "CRITICAL",
        title: "Database readiness check failed",
        summary: "The scheduled System Guardian check could not reach the database.",
        route: "/api/guardian/cron",
        httpStatus: 503,
      });
    } catch {
      // Do not expose database or persistence internals in the response.
    }

    return NextResponse.json({
      ok: false,
      checks: { database: "error" },
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
}
