import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API = "https://api.line.me/v2/bot";
const LINE_REQUEST_TIMEOUT_MS = 5_000;

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const supplied = Buffer.from(signature, "base64");

  // Buffer.from(base64) is permissive; require the canonical encoding LINE sends.
  if (supplied.length !== expected.length || supplied.toString("base64") !== signature) return false;
  return timingSafeEqual(supplied, expected);
}

async function lineRequest(path: string, body: unknown): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const response = await fetch(`${LINE_API}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(LINE_REQUEST_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    // Do not expose LINE credentials or upstream response details to callers/logs.
    return false;
  }
}

export function replyLineMessage(replyToken: string, text: string): Promise<boolean> {
  return lineRequest("message/reply", {
    replyToken,
    messages: [{ type: "text", text: text.slice(0, 4500) }],
  });
}

export function pushLineMessage(userId: string, text: string): Promise<boolean> {
  return lineRequest("message/push", {
    to: userId,
    messages: [{ type: "text", text: text.slice(0, 4500) }],
  });
}
