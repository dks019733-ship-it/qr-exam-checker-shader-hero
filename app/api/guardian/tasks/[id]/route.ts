import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSystemOwner } from "@/lib/system-guardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSystemOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const task = await prisma.systemGuardianTask.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        currentStep: true,
        progressPercent: true,
        resultSummary: true,
        failureCode: true,
        attempts: true,
        maxAttempts: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        events: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, step: true, message: true, progressPercent: true, createdAt: true },
        },
      },
    });

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({ ok: true, task }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load Guardian task" }, { status: 503 });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSystemOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const result = await prisma.systemGuardianTask.updateMany({
      where: { id, status: "QUEUED" },
      data: {
        status: "CANCELLED",
        currentStep: "ยกเลิกโดยเจ้าของระบบ",
        completedAt: new Date(),
      },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Task is not queued or does not exist" }, { status: 409 });
    }

    await prisma.systemGuardianTaskEvent.create({
      data: {
        taskId: id,
        status: "CANCELLED",
        step: "CANCELLED",
        message: "เจ้าของระบบยกเลิกงานก่อนเริ่มดำเนินการ",
      },
    });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  } catch {
    return NextResponse.json({ error: "Unable to cancel Guardian task" }, { status: 503 });
  }
}
