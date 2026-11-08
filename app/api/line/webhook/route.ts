import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FEATURE_CATALOG, type FeatureKey } from "@/lib/feature-availability";
import { pushLineMessage, replyLineMessage, verifyLineSignature } from "@/lib/line-guardian";
import { PayloadTooLargeError, readLimitedBody } from "@/lib/line-webhook-body.mjs";
import { createGuardianRetry } from "@/lib/guardian-task-retry.mjs";

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
    && event.message.text.length <= 5_000
    && (event.replyToken === undefined || (typeof event.replyToken === "string" && event.replyToken.length > 0 && event.replyToken.length <= 256));
}

async function deliver(event: LineEvent, ownerLineId: string, text: string) {
  const replied = event.replyToken ? await replyLineMessage(event.replyToken, text) : false;
  if (replied) return true;
  return pushLineMessage(ownerLineId, text);
}

const featureAliases: Record<string, FeatureKey> = {
  "กระดาษคำตอบ": "answer_sheet", "ระบบกระดาษคำตอบ": "answer_sheet", "answer_sheet": "answer_sheet",
  "เช็กชื่อ": "attendance", "เช็คชื่อ": "attendance", "ระบบเช็กชื่อ": "attendance", "attendance": "attendance",
  "มอบหมายงาน": "assignments", "ระบบมอบหมายงาน": "assignments", "assignments": "assignments",
  "ข้อสอบ": "exams", "ระบบข้อสอบ": "exams", "exams": "exams",
  "คะแนน": "gradebook", "สมุดคะแนน": "gradebook", "ระบบคะแนน": "gradebook", "gradebook": "gradebook",
  "ai": "ai", "ผู้ช่วย ai": "ai", "ผู้ช่วยเอไอ": "ai",
};

function parseFeatureDuration(value: string): { milliseconds: number; rest: string } | null {
  const match = value.match(/^(\d{1,4})\s*(นาที|น\.|ชม\.?|ชั่วโมง|วัน|สัปดาห์)\s*(.*)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < 1) return null;
  const unit = match[2];
  const multiplier = unit.startsWith("น") ? 60_000
    : unit.startsWith("ชม") || unit === "ชั่วโมง" ? 3_600_000
    : unit === "วัน" ? 86_400_000 : 604_800_000;
  const milliseconds = amount * multiplier;
  if (milliseconds > 30 * 86_400_000) return null;
  return { milliseconds, rest: match[3].trim() };
}

function resolveFeature(value: string): FeatureKey | null {
  const normalized = value.trim().toLocaleLowerCase("th-TH");
  return featureAliases[normalized] ?? null;
}

function featureTime(value: Date | null) {
  if (!value) return "ไม่กำหนดเวลาเปิด";
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(value);
}

async function handleFeatureCommand(command: string, ownerLineId: string): Promise<string | null> {
  if (command === "สถานะฟีเจอร์" || command === "รายการฟีเจอร์") {
    const rows = await prisma.featureAvailability.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const now = Date.now();
    return ["สถานะฟีเจอร์ในเว็บไซต์:", ...Object.entries(FEATURE_CATALOG).map(([key, label]) => {
      const row = byKey.get(key);
      const expired = row?.untilAt && row.untilAt.getTime() <= now;
      const status = !row && key === "answer_sheet" ? "ไม่พร้อมใช้งาน"
        : !row || row.status === "AVAILABLE" || expired ? "พร้อมใช้งาน"
        : row.status === "MAINTENANCE" ? "ปิดปรับปรุง" : "ไม่พร้อมใช้งาน";
      return `• ${label}: ${status}${status !== "พร้อมใช้งาน" && row?.reason ? ` — ${row.reason}` : status === "ไม่พร้อมใช้งาน" && !row ? " — อยู่ระหว่างเตรียมพัฒนา" : ""}${status !== "พร้อมใช้งาน" ? `\n  เปิดอีกครั้ง: ${featureTime(row?.untilAt ?? null)}` : ""}`;
    })].join("\n");
  }

  const action = command.startsWith("ปิดปรับปรุง ") ? "MAINTENANCE"
    : command.startsWith("ไม่พร้อมใช้งาน ") ? "UNAVAILABLE"
    : command.startsWith("เปิดใช้งาน ") || command.startsWith("เปิดฟีเจอร์ ") ? "AVAILABLE"
    : null;
  if (!action) return null;

  const prefix = action === "MAINTENANCE" ? "ปิดปรับปรุง "
    : action === "UNAVAILABLE" ? "ไม่พร้อมใช้งาน "
    : command.startsWith("เปิดใช้งาน ") ? "เปิดใช้งาน " : "เปิดฟีเจอร์ ";
  const rest = command.slice(prefix.length).trim();
  const featureName = Object.keys(featureAliases).sort((a, b) => b.length - a.length).find((name) => rest.toLocaleLowerCase("th-TH").startsWith(name));
  if (!featureName) return "ไม่รู้จักชื่อฟีเจอร์ พิมพ์ “สถานะฟีเจอร์” เพื่อดูรายการ";
  const key = featureAliases[featureName];
  let tail = rest.slice(featureName.length).trim();

  if (action === "AVAILABLE") {
    await prisma.featureAvailability.upsert({
      where: { key },
      create: { key, status: "AVAILABLE", reason: "", untilAt: null, updatedBy: ownerLineId },
      update: { status: "AVAILABLE", reason: "", untilAt: null, updatedBy: ownerLineId },
    });
    return `เปิดใช้งาน ${FEATURE_CATALOG[key]} แล้ว`;
  }

  let untilAt: Date | null = null;
  const duration = parseFeatureDuration(tail);
  if (duration) {
    untilAt = new Date(Date.now() + duration.milliseconds);
    tail = duration.rest;
  } else if (/^\d/.test(tail)) {
    return "รูปแบบเวลาไม่ถูกต้อง ใช้ 30 นาที, 2 ชม., 1 วัน หรือ 1 สัปดาห์ (สูงสุด 30 วัน)";
  }
  const reason = tail.replace(/^(เหตุผล|เพราะ)\s*/, "").slice(0, 240);
  await prisma.featureAvailability.upsert({
    where: { key },
    create: { key, status: action, reason, untilAt, updatedBy: ownerLineId },
    update: { status: action, reason, untilAt, updatedBy: ownerLineId },
  });
  const statusText = action === "MAINTENANCE" ? "ปิดปรับปรุง" : "ตั้งเป็นไม่พร้อมใช้งาน";
  return `${FEATURE_CATALOG[key]}: ${statusText} แล้ว\n${reason ? `เหตุผล: ${reason}\n` : ""}เปิดอีกครั้ง: ${featureTime(untilAt)}`;
}

async function executeCommand(command: string, ownerLineId: string): Promise<string | null> {
  const featureResponse = await handleFeatureCommand(command, ownerLineId);\n  if (featureResponse) return featureResponse;
  if (command.startsWith("ประกาศ ")) {
    const message = command.slice("ประกาศ ".length).trim();
    if (!message) return "กรุณาพิมพ์ข้อความหลังคำว่า ประกาศ";
    if (message.length > 240) return "ข้อความยาวเกิน 240 ตัวอักษร กรุณาย่อข้อความ";
    await prisma.siteAnnouncement.upsert({
      where: { id: "global" },
      create: { id: "global", message, active: true, source: "LINE" },
      update: { message, active: true, source: "LINE", deploymentId: null, deploymentStatus: null, deploymentUrl: null },
    });
    return `ตั้งประกาศหน้าเว็บแล้ว:\n${message}`;
  }

  if (command === "ประกาศเสร็จแล้ว") {
    const message = "อัปเดตระบบแล้ว · ตรวจคำตอบ Google Forms แยกห้อง พร้อมตรวจคะแนนรายข้อแบบเรียลไทม์";
    await prisma.siteAnnouncement.upsert({
      where: { id: "global" },
      create: { id: "global", message, active: true, source: "LINE" },
      update: { message, active: true, source: "LINE", deploymentId: null, deploymentStatus: null, deploymentUrl: null },
    });
    return "เปลี่ยนแถบหน้าเว็บเป็นสถานะอัปเดตสำเร็จแล้ว";
  }

  if (command === "ซ่อนประกาศ") {
    await prisma.siteAnnouncement.upsert({
      where: { id: "global" },
      create: { id: "global", message: "อัปเดตระบบแล้ว", active: false, source: "LINE" },
      update: { active: false, source: "LINE" },
    });
    return "ซ่อนแถบประกาศหน้าเว็บแล้ว";
  }

  if (command === "สถานะประกาศ") {
    const announcement = await prisma.siteAnnouncement.findUnique({ where: { id: "global" } });
    if (!announcement) return "ยังใช้ข้อความประกาศเริ่มต้นของเว็บไซต์อยู่";
    return `สถานะประกาศ: ${announcement.active ? "แสดงอยู่" : "ซ่อนอยู่"}\nแหล่งที่มา: ${announcement.source}\n${announcement.message}`;
  }
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
      "• ประกาศ <ข้อความ> — เปลี่ยนข้อความแถบหน้าเว็บ",
      "• ประกาศเสร็จแล้ว — แสดงข้อความอัปเดตสำเร็จ",
      "• ซ่อนประกาศ — ซ่อนแถบข้อความหน้าเว็บ",
      "• สถานะประกาศ — ดูข้อความปัจจุบัน",
      "• สถานะฟีเจอร์ — ดูสถานะทุกระบบ",\n      "• ปิดปรับปรุง <ฟีเจอร์> <เวลา> <เหตุผล> — ปิดตามระยะเวลา",
      "• ไม่พร้อมใช้งาน <ฟีเจอร์> <เวลา> <เหตุผล> — ระบุฟีเจอร์ที่ยังไม่เปิด",
      "• เปิดใช้งาน <ฟีเจอร์> — เปิดฟีเจอร์ทันที",
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
      select: { id: true, requestedBy: true, attempts: true, maxAttempts: true },
    });
    if (!failed) return "ไม่พบงานตรวจระบบที่ล้มเหลวและรอ retry";
    const retry = await createGuardianRetry(prisma, failed, ownerLineId);
    if (retry.status === "limit") return "งานล่าสุดใช้จำนวน retry ครบตามขีดจำกัดแล้ว จึงไม่เริ่มซ้ำ";
    if (retry.status === "already_retried") return "งานนี้มีการสร้าง retry ไปแล้ว จึงไม่สร้างงานซ้ำ";
    return `สร้างงาน retry แล้ว #${retry.taskId.slice(-8)}\nจะส่งผลผ่าน LINE เมื่อเสร็จ`;
  }

  if (command === "หยุดงาน") {
    const queued = await prisma.systemGuardianTask.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!queued) return "ไม่มีงานที่รอคิวให้ยกเลิก";
    const cancelled = await prisma.$transaction(async (tx) => {
      const result = await tx.systemGuardianTask.updateMany({
        where: { id: queued.id, status: "QUEUED" },
        data: { status: "CANCELLED", currentStep: "ยกเลิกโดยเจ้าของระบบ", completedAt: new Date() },
      });
      if (result.count !== 1) return false;
      await tx.systemGuardianTaskEvent.create({
        data: { taskId: queued.id, status: "CANCELLED", step: "CANCELLED", message: "ยกเลิกจาก LINE" },
      });
      return true;
    });
    if (!cancelled) return "งานเริ่มทำไปแล้วหรือมีการเปลี่ยนสถานะ จึงยกเลิกไม่ได้";
    return `ยกเลิกงาน #${queued.id.slice(-8)} แล้ว`;
  }

  return null;
}

export async function POST(request: Request) {
  let rawBody: Buffer;
  try {
    rawBody = await readLimitedBody(request, 64_000);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify the exact, unmodified body before JSON parsing.
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { events?: unknown };
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as { events?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload || !Array.isArray(payload.events) || payload.events.length > 100) {
    return NextResponse.json({ error: "Invalid events payload" }, { status: 400 });
  }

  const ownerLineId = process.env.LINE_OWNER_USER_ID;
  for (const candidate of payload.events) {
    if (!isLineEvent(candidate)) continue;
    const event = candidate;

    const command = normalizeCommand(event.message?.text ?? "");
    if (command === "myid") {
      const userId = event.source?.userId;
      const delivered = event.replyToken && userId
        ? await replyLineMessage(event.replyToken, `LINE User ID: ${userId}`)
        : false;
      if (!delivered) {
        return NextResponse.json({ error: "Unable to reply through LINE" }, { status: 503 });
      }
      continue;
    }

    if (!ownerLineId) {
      return NextResponse.json({ ok: true, ignored: "owner_not_configured" });
    }
    if (event.source?.userId !== ownerLineId) continue;

    const supported = [
      "ช่วยเหลือ", "help", "เมนู", "ตรวจสอบระบบ", "สถานะระบบ",
      "สถานะการซ่อม", "วิเคราะห์ปัญหาล่าสุด", "ลองงานที่ล้มเหลวใหม่", "หยุดงาน",
      "ประกาศเสร็จแล้ว", "ซ่อนประกาศ", "สถานะประกาศ", "สถานะฟีเจอร์", "รายการฟีเจอร์",
    ].includes(command) || command.startsWith("ประกาศ ") || command.startsWith("ปิดปรับปรุง ") || command.startsWith("ไม่พร้อมใช้งาน ") || command.startsWith("เปิดใช้งาน ") || command.startsWith("เปิดฟีเจอร์ ");
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
      // Keep the event claim: command execution may already have created a task.
      // Retrying this webhook could otherwise enqueue duplicate work.
      continue;
    }
  }

  return NextResponse.json({ ok: true });
}
