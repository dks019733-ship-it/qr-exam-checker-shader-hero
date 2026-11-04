import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024 * 1024;
const USER_ID_COMMAND = /^(myid|ขอ user id|ขอไอดีไลน์)$/i;

type LineEvent = {
  events?: unknown;
  type?: unknown;
  replyToken?: unknown;
  source?: {
    type?: unknown;
    userId?: unknown;
  };
  message?: {
    type?: unknown;
    text?: unknown;
  };
};

function isLineEvent(value: unknown): value is LineEvent {
  return typeof value === "object" && value !== null;
}

function hasValidSignature(body: string, signature: string, channelSecret: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;
  const expected = createHmac("sha256", channelSecret).update(body).digest();
  const provided = Buffer.from(signature, "base64");
  return (
    provided.toString("base64") === signature &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

async function replyWithUserId(replyToken: string, userId: string, accessToken: string) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: `LINE User ID: ${userId}` }],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed with status ${response.status}`);
  }
}

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return NextResponse.json({ error: "LINE webhook is not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-line-signature");
  if (!signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!hasValidSignature(body, signature, channelSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = isLineEvent(payload) && Array.isArray(payload.events) ? payload.events : [];
  for (const rawEvent of events) {
    if (!isLineEvent(rawEvent)) continue;

    const userId = rawEvent.source?.userId;
    const replyToken = rawEvent.replyToken;
    const text = rawEvent.message?.text;
    if (
      rawEvent.type !== "message" ||
      rawEvent.source?.type !== "user" ||
      rawEvent.message?.type !== "text" ||
      typeof userId !== "string" ||
      typeof replyToken !== "string" ||
      typeof text !== "string" ||
      !USER_ID_COMMAND.test(text.trim())
    ) {
      continue;
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "LINE messaging is not configured" }, { status: 500 });
    }

    try {
      await replyWithUserId(replyToken, userId, accessToken);
    } catch {
      return NextResponse.json({ error: "Unable to reply through LINE" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
