import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/system-guardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MESSAGE = "อัปเดตระบบแล้ว · ตรวจคำตอบ Google Forms แยกห้อง พร้อมตรวจคะแนนรายข้อแบบเรียลไทม์";

export async function GET() {
  try {
    const announcement = await prisma.siteAnnouncement.findUnique({
      where: { id: "global" },
      select: { active: true, message: true, source: true, updatedAt: true },
    });
    return NextResponse.json({
      active: announcement?.active ?? true,
      message: announcement?.message ?? DEFAULT_MESSAGE,
      source: announcement?.source ?? "DEFAULT",
      updatedAt: announcement?.updatedAt ?? null,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({
      active: true,
      message: DEFAULT_MESSAGE,
      source: "DEFAULT",
      updatedAt: null,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}

export async function POST(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const environment = typeof input.environment === "string" ? input.environment.toLowerCase() : "";
  const eventType = input.eventType;
  const deploymentId = typeof input.deploymentId === "string" ? input.deploymentId : "";
  const state = eventType === "deployment" ? "in_progress" : input.state;
  const deploymentUrl = typeof input.deploymentUrl === "string" ? input.deploymentUrl.slice(0, 1000) : null;

  if (environment !== "production") return NextResponse.json({ ok: true, ignored: "non_production" });
  if (!["deployment", "deployment_status"].includes(String(eventType))) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  }
  if (!/^\d{1,30}$/.test(deploymentId)) {
    return NextResponse.json({ error: "Invalid deployment ID" }, { status: 400 });
  }
  if (!["in_progress", "success", "failure", "error"].includes(String(state))) {
    return NextResponse.json({ ok: true, ignored: "unsupported_state" });
  }

  try {
    const current = await prisma.siteAnnouncement.findUnique({
      where: { id: "global" },
      select: { deploymentId: true, deploymentStatus: true },
    });
    if (current?.deploymentId) {
      const previousId = BigInt(current.deploymentId);
      const incomingId = BigInt(deploymentId);
      if (incomingId < previousId) return NextResponse.json({ ok: true, ignored: "stale_deployment" });
      if (
        incomingId === previousId
        && current.deploymentStatus !== "in_progress"
        && state === "in_progress"
      ) {
        return NextResponse.json({ ok: true, ignored: "stale_status" });
      }
    }

    const message = state === "in_progress"
      ? "กำลังอัปเดตระบบ · กำลัง Deploy เวอร์ชันใหม่"
      : state === "success"
        ? DEFAULT_MESSAGE
        : "อัปเดตระบบไม่สำเร็จ · กำลังตรวจสอบปัญหา";

    await prisma.siteAnnouncement.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        message,
        active: true,
        source: "DEPLOYMENT",
        deploymentId,
        deploymentStatus: String(state),
        deploymentUrl,
      },
      update: {
        message,
        active: true,
        source: "DEPLOYMENT",
        deploymentId,
        deploymentStatus: String(state),
        deploymentUrl,
      },
    });

    return NextResponse.json({ ok: true, state });
  } catch {
    return NextResponse.json({ error: "Unable to update deployment status" }, { status: 503 });
  }
}
