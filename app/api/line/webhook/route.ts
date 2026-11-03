import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pushLineMessage, replyLineMessage, verifyLineSignature } from "@/lib/line-guardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineEvent = {
  type?: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

const normalizeCommand = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

function isLineEvent(value: unknown): value is LineEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as LineEvent;
  return event.type === "message"
    && typeof event.webhookEventId === "string"
    && event.webhookEventId.length > 0
    && event.webhookEventId.length <= 200
    && event.source?.type === "user"
    && typeof event.source.userId === "string"
    && event.message?.type === "text"
    && typeof event.message.text === "string"
    && event.message.text.length <= 5_000;
}

async function deliver(event: LineEvent, ownerLineId: string, text: string) {
  const replied = event.replyToken ? await replyLineMessage(event.replyToken, text) : false;
  if (replied) return true;
  return pushLineMessage(ownerLineId, text);
}

async function executeCommand(command: string, ownerLineId: string): Promise<string | null> {
  if (["ช่วยเหลือ", "help", "เมนู"].includes(command)) {
    return [
      "LINE Guardian",
      "คำสั่งที่ใช้ได้:",
      "• ตรวจสอบระบบ — เข้าคิวตรวจสุขภาพระบบ",
      "• สถานะระบบ — ดูฐานข้อมูลและ Incident",
      "• สถานะการซ่อม — ดูงานล่าสุด",
      "• วิเคราะห์ปัญหาล่าสุด — สรุป Incident ล่าสุด",
      "• ลองงานที่ล้มเหลวใหม่ — retry เฉพาะงานตรวจระบบที่ retry ได้",
      "• หยุดงาน — ยกเลิกงานที่ยังอยู่ในคิว",
      "",
      "ระบบไม่รับคำสั่ง shell, SQL, โค้ด หรือคำสั่งแก้ข้อมูลนักเรียน/คะแนน",
    ].join("\n");
  }

  if (command === "ตรวจสอบระบบ") {
    const requestedBy = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
    if (!requestedBy) return "ยังไม่ได้ตั้งค่า SYSTEM_OWNER_EMAIL จึงไม่สามารถสร้างงานได้";
    const task = await prisma.systemGuardianTask.create({
      data: {
        type: "SYSTEM_HEALTH_CHECK",
        requestedBy,
        source: "LINE",
        notifyLineUserId: ownerLineId,
        currentStep: "รอเริ่มตรวจสอบ",
        events: {
          create: {
            status: "QUEUED",
            step: "QUEUED",
            message: "รับคำสั่งจาก LINE และเพิ่มงานเข้าคิวแล้ว",
            progressPercent: 0,
          },
        },
      },
      select: { id: true },
    });
    return `รับคำสั่งแล้ว งาน #${task.id.slice(-8)} อยู่ในคิว\nระบบจะแจ้งผลผ่าน LINE เมื่อประมวลผลเสร็จ\nเวลารอ: ยังไม่สามารถประเมินได้`;
  }

  if (command === "สถานะระบบ") {
    await prisma.$queryRaw`SELECT 1`;
    const [openIncidents, queuedTasks, runningTasks, failedTasks] = await Promise.all([
      prisma.systemIncident.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
      prisma.systemGuardianTask.count({ where: { status: "QUEUED" } }),
      prisma.systemGuardianTask.count({ where: { status: "RUNNING" } }),
      prisma.systemGuardianTask.count({ where: { status: "FAILED" } }),
    ]);
    return [
      "สถานะ System Guardian",
      "ฐานข้อมูล: เชื่อมต่อได้",
      `Incident ที่ยังเปิด: ${openIncidents}`,
      `งานรอคิว: ${queuedTasks} · กำลังทำ: ${runningTasks} · ล้มเหลว: ${failedTasks}`,
      `ตรวจเมื่อ: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
    ].join("\n");
  }

  if (command === "สถานะการซ่อม") {
    const tasks = await prisma.systemGuardianTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, status: true, currentStep: true, progressPercent: true, createdAt: true, resultSummary: true },
    });
    if (tasks.length === 0) return "ยังไม่มีงานในประวัติ System Guardian";
    return ["งาน System Guardian ล่าสุด:", ...tasks.map((task) =>
      `#${task.id.slice(-8)} · ${task.status} · ${task.progressPercent}%\n${task.currentStep ?? task.resultSummary ?? task.type}`
    )].join("\n");
  }

  if (command === "วิเคราะห์ปัญหาล่าสุด") {
    const incidents = await prisma.systemIncident.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 5,
      select: { severity: true, status: true, title: true, occurrenceCount: true, lastSeenAt: true },
    });
    if (incidents.length === 0) return "ไม่พบ Incident ในประวัติที่บันทึกไว้";
    return ["Incident ล่าสุด:", ...incidents.map((item) =>
      `[${item.severity}/${item.status}] ${item.title} · เกิด ${item.occurrenceCount} ครั้ง`
    )].join("\n");
  }

  if (command === "ลองงานที่ล้มเหลวใหม่") {
    const failed = await prisma.systemGuardianTask.findFirst({
      where: { type: "SYSTEM_HEALTH_CHECK", status: "FAILED" },
      orderBy: { completedAt: "desc" },
      select: { requestedBy: true, attempts: true, maxAttempts: true },
    });
    if (!failed) return "ไม่พบงานตรวจระบบที่ล้มเหลวและรอ retry";
    if (failed.attempts >= failed.maxAttempts) return "งานล่าสุดใช้จำนวน retry ครบตามขีดจำกัดแล้ว จึงไม่เริ่มซ้ำ";
    const task = await prisma.systemGuardianTask.create({
      data: {
        type: "SYSTEM_HEALTH_CHECK",
        requestedBy: failed.requestedBy,
        source: "LINE_RETRY",
        notifyLineUserId: ownerLineId,
        attempts: failed.attempts,
        maxAttempts: failed.maxAttempts,
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
    return `สร้างงาน retry แล้ว #${task.id.slice(-8)}\nจะส่งผลผ่าน LINE เมื่อเสร็จ`;
  }

  if (command === "หยุดงาน") {
    const queued = await prisma.systemGuardianTask.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!queued) return "ไม่มีงานที่รอคิวให้ยกเลิก";
    const cancelled = await prisma.systemGuardianTask.updateMany({
      where: { id: queued.id, status: "QUEUED" },
      data: { status: "CANCELLED", currentStep: "ยกเลิกโดยเจ้าของระบบ", completedAt: new Date() },
    });
    if (cancelled.count !== 1) return "งานเริ่มทำไปแล้วหรือมีการเปลี่ยนสถานะ จึงยกเลิกไม่ได้";
    await prisma.systemGuardianTaskEvent.create({
      data: { taskId: queued.id, status: "CANCELLED", step: "CANCELLED", message: "ยกเลิกจาก LINE" },
    });
    return `ยกเลิกงาน #${queued.id.slice(-8)} แล้ว`;
  }

  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 64_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Verify the exact, unmodified body before JSON parsing.
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { events?: unknown };
  try {
    payload = JSON.parse(rawBody) as { events?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload || !Array.isArray(payload.events) || payload.events.length > 100) {
    return NextResponse.json({ error: "Invalid events payload" }, { status: 400 });
  }

  const ownerLineId = process.env.LINE_OWNER_USER_ID;
  if (!ownerLineId) {
    return NextResponse.json({ ok: true, ignored: "owner_not_configured" });
  }

  for (const candidate of payload.events) {
    if (!isLineEvent(candidate)) continue;
    const event = candidate;
    if (event.source?.userId !== ownerLineId) continue;

    const command = normalizeCommand(event.message?.text ?? "");
    const supported = [
      "ช่วยเหลือ", "help", "เมนู", "ตรวจสอบระบบ", "สถานะระบบ",
      "สถานะการซ่อม", "วิเคราะห์ปัญหาล่าสุด", "ลองงานที่ล้มเหลวใหม่", "หยุดงาน",
    ].includes(command);
    if (!supported) continue;

    let storedEventId: string;
    try {
      const storedEvent = await prisma.lineWebhookEvent.create({
        data: {
          webhookEventId: event.webhookEventId!,
          sourceUserId: event.source!.userId!,
          eventType: event.type!,
        },
        select: { id: true },
      });
      storedEventId = storedEvent.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 });
    }

    let responseText: string;
    try {
      responseText = await executeCommand(command, ownerLineId) ?? "ไม่รู้จักคำสั่งนี้ พิมพ์ “ช่วยเหลือ”";
    } catch {
      await prisma.lineWebhookEvent.delete({ where: { id: storedEventId } }).catch(() => undefined);
      return NextResponse.json({ error: "Command temporarily unavailable" }, { status: 503 });
    }

    const delivered = await deliver(event, ownerLineId, responseText);
    if (!delivered) {
      await prisma.lineWebhookEvent.delete({ where: { id: storedEventId } }).catch(() => undefined);
      return NextResponse.json({ error: "Message delivery unavailable" }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true });
}
