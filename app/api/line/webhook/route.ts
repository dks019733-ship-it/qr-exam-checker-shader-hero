import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replyLineMessage, verifyLineSignature } from "@/lib/line-guardian";

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

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 64_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ownerLineId = process.env.LINE_OWNER_USER_ID;
  if (!ownerLineId) {
    return NextResponse.json({ ok: true, ignored: "owner_not_configured" });
  }

  let deliveryFailed = false;

  for (const event of payload.events ?? []) {
    if (
      event.type !== "message" ||
      event.message?.type !== "text" ||
      event.source?.type !== "user" ||
      event.source.userId !== ownerLineId ||
      !event.webhookEventId
    ) continue;

    let storedEventId: string;
    try {
      const storedEvent = await prisma.lineWebhookEvent.create({
        data: {
          webhookEventId: event.webhookEventId,
          sourceUserId: event.source.userId,
          eventType: event.type,
        },
      });
      storedEventId = storedEvent.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      // A persistence failure must not execute the same command without idempotency.
      continue;
    }

    const command = (event.message.text ?? "").slice(0, 120);
    let dbOk = false;
    let openIncidents = 0;

    if (["ตรวจสอบระบบ", "สถานะระบบ", "สถานะการซ่อม", "status"].includes(command.trim().toLowerCase())) {
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

    if (event.replyToken) {
      const replied = await replyLineMessage(
        event.replyToken,
        commandResponse(command, openIncidents, dbOk),
      );
      if (!replied) {
        deliveryFailed = true;
        await prisma.lineWebhookEvent.delete({ where: { id: storedEventId } }).catch(() => undefined);
      }
    }
  }

  return deliveryFailed
    ? NextResponse.json({ error: "Temporary message delivery failure" }, { status: 503 })
    : NextResponse.json({ ok: true });
}
