import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemOwner } from "@/lib/system-guardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isSystemOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = await prisma.systemGuardianTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
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
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, status: true, step: true, message: true, progressPercent: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({ ok: true, tasks }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load Guardian tasks" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isSystemOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { type?: unknown; source?: unknown } | null;
  if (body?.type !== "SYSTEM_HEALTH_CHECK") {
    return NextResponse.json({ error: "Unsupported task type" }, { status: 400 });
  }

  const session = await auth();
  const requestedBy = session?.user?.email?.trim().toLowerCase()
    || process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  if (!requestedBy) {
    return NextResponse.json({ error: "Owner identity unavailable" }, { status: 403 });
  }

  try {
    const task = await prisma.systemGuardianTask.create({
      data: {
        type: "SYSTEM_HEALTH_CHECK",
        requestedBy,
        source: body.source === "LINE" ? "LINE" : "WEB",
        notifyLineUserId: body.source === "LINE" ? process.env.LINE_OWNER_USER_ID || null : null,
        currentStep: "รอเริ่มตรวจสอบ",
        events: {
          create: {
            status: "QUEUED",
            step: "QUEUED",
            message: "เพิ่มงานตรวจสอบระบบเข้าคิวแล้ว",
            progressPercent: 0,
          },
        },
      },
      select: { id: true, type: true, status: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, task }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Unable to queue Guardian task" }, { status: 503 });
  }
}
