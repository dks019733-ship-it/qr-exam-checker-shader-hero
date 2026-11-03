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

function commandResponse(command: string, openIncidents: number, dbOk: boolean): string {
  const normalized = command.trim().replace(/\s+/g, " ");

  if (["ช่วยเหลือ", "help", "เมนู"].includes(normalized.toLowerCase())) {
    return [
      "LINE Guardian",
      "คำสั่งที่ใช้ได้:",
      "• ตรวจสอบระบบ — ตรวจฐานข้อมูล",
      "• สถานะระบบ — ดูสถานะฐานข้อมูลและ Incident",
      "• สถานะการซ่อม — ดูจำนวนปัญหาที่ยังเปิดอยู่",
      "",
      "คำสั่งซ่อมโค้ดหรือแก้ข้อมูลจริงยังไม่เปิดให้ทำผ่าน LINE เพื่อป้องกันการแก้ไขโดยไม่ผ่านการตรวจสอบ",
    ].join("\n");
  }

  if (["ตรวจสอบระบบ", "สถานะระบบ", "สถานะการซ่อม", "status"].includes(normalized.toLowerCase())) {
    return [
      "ผลตรวจสอบ System Guardian",
      `ฐานข้อมูล: ${dbOk ? "เชื่อมต่อได้" : "เชื่อมต่อไม่ได้"}`,
      `Incident ที่ยังเปิดอยู่: ${openIncidents}`,
      `ตรวจเมื่อ: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
      dbOk ? "ระบบฐานข้อมูลตอบสนองปกติจากการตรวจครั้งนี้" : "พบปัญหาการเชื่อมต่อฐานข้อมูล ต้องตรวจสอบเพิ่มเติม",
    ].join("\n");
  }

  return "ไม่รู้จักคำสั่งนี้ พิมพ์ “ช่วยเหลือ” เพื่อดูคำสั่งที่รองรับ";
}

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
    const command = event.message?.text?.slice(0, 120) ?? "";
    const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();
    const supported = ["ช่วยเหลือ", "help", "เมนู", "ตรวจสอบระบบ", "สถานะระบบ", "สถานะการซ่อม", "status"].includes(normalized);
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // A previously accepted delivery is already being/has been handled.
        continue;
      }
      // Do not acknowledge a command if durable idempotency storage is unavailable.
      return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 });
    }

    let dbOk = false;
    let openIncidents = 0;
    if (["ตรวจสอบระบบ", "สถานะระบบ", "สถานะการซ่อม", "status"].includes(normalized)) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbOk = true;
        openIncidents = await prisma.systemIncident.count({
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        });
      } catch {
        dbOk = false;
      }
    }

    const responseText = commandResponse(command, openIncidents, dbOk);
    const replied = event.replyToken
      ? await replyLineMessage(event.replyToken, responseText)
      : false;

    if (!replied) {
      // Reply tokens are short-lived and one-use. Fall back to a push message;
      // retain the idempotency record once either delivery path succeeds.
      const pushed = await pushLineMessage(ownerLineId, responseText);
      if (!pushed) {
        await prisma.lineWebhookEvent.delete({ where: { id: storedEventId } }).catch(() => undefined);
        return NextResponse.json({ error: "Message delivery unavailable" }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
