import { NextResponse } from "next/server";
import { isValidCronSecret, recordSystemIncident } from "@/lib/system-guardian";
import { pushLineMessage } from "@/lib/line-guardian";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function processNextTask(): Promise<boolean> {
  const candidate = await prisma.systemGuardianTask.findFirst({
    where: { status: "QUEUED", type: "SYSTEM_HEALTH_CHECK" },
    orderBy: { createdAt: "asc" },
    select: { id: true, notifyLineUserId: true },
  });
  if (!candidate) return false;

  // Atomic claim prevents two overlapping cron invocations from executing one task twice.
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

  await prisma.systemGuardianTaskEvent.create({
    data: {
      taskId: candidate.id,
      status: "RUNNING",
      step: "DATABASE_CHECK",
      message: "เริ่มตรวจสอบการเชื่อมต่อฐานข้อมูล",
      progressPercent: 25,
    },
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    const openIncidents = await prisma.systemIncident.count({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    });
    const summary = `ตรวจสอบฐานข้อมูลสำเร็จ · Incident ที่ยังเปิดอยู่ ${openIncidents} รายการ`;

    await prisma.systemGuardianTask.update({
      where: { id: candidate.id },
      data: {
        status: "SUCCEEDED",
        currentStep: "ตรวจสอบเสร็จแล้ว",
        progressPercent: 100,
        resultSummary: summary,
        completedAt: new Date(),
      },
    });
    await prisma.systemGuardianTaskEvent.create({
      data: {
        taskId: candidate.id,
        status: "SUCCEEDED",
        step: "COMPLETED",
        message: summary,
        progressPercent: 100,
      },
    });

    if (candidate.notifyLineUserId) {
      await pushLineMessage(candidate.notifyLineUserId, `System Guardian\nงานตรวจสอบเสร็จแล้ว\n${summary}`);
    }
    return true;
  } catch {
    const summary = "ตรวจสอบไม่สำเร็จ ระบบไม่สามารถยืนยันสถานะฐานข้อมูลได้";
    await prisma.systemGuardianTask.update({
      where: { id: candidate.id },
      data: {
        status: "FAILED",
        currentStep: "การตรวจสอบล้มเหลว",
        progressPercent: 25,
        resultSummary: summary,
        failureCode: "HEALTH_CHECK_FAILED",
        completedAt: new Date(),
      },
    });
    await prisma.systemGuardianTaskEvent.create({
      data: {
        taskId: candidate.id,
        status: "FAILED",
        step: "FAILED",
        message: summary,
        progressPercent: 25,
      },
    });
    if (candidate.notifyLineUserId) {
      await pushLineMessage(candidate.notifyLineUserId, `System Guardian\n${summary}`);
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
